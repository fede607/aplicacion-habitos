import "server-only";
import type { ServerSupabase } from "../supabase/server";
import type { HabitCategory, HabitLogStatus, HabitRevisionRow, RankSnapshotRow } from "../database.types";
import { addDays, type IsoDate } from "../dates";
import { logServerError } from "../errors";
import { computeRank, localDateOf, phaseFor, RANK_CONFIG, type RankHabitRevision, type RankLog, type RankResult } from "../rank/engine";

export type RankHabitMeta = {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: HabitCategory;
  weight: number;
  archived: boolean;
  isActive: boolean;
};

export type MemberRank = { result: RankResult; habits: RankHabitMeta[] };

type RankGroup = { id: string; start_date: IsoDate; end_date: IsoDate; streak_threshold: number };

const LOG_PAGE = 1000;

/** Ventana del cálculo: desde que empezó el arc (o te uniste) hasta hoy (o el final del arc). */
export function rankRange(group: RankGroup, joinedAt: string, timeZone: string, today: IsoDate) {
  const joinedOn = localDateOf(joinedAt, timeZone) ?? group.start_date;
  let from = group.start_date > joinedOn ? group.start_date : joinedOn;
  const limit = addDays(today, -RANK_CONFIG.maxRangeDays);
  if (from < limit) from = limit;
  const to = group.end_date < today ? group.end_date : today;
  return { from, to };
}

/** Calcula el rango de un miembro (RLS decide qué registros puede ver quien pregunta). */
export async function getMemberRank(
  supabase: ServerSupabase,
  opts: { group: RankGroup; memberId: string; joinedAt: string; timeZone: string; today: IsoDate },
): Promise<MemberRank> {
  const { group, memberId, joinedAt, timeZone, today } = opts;
  const { from, to } = rankRange(group, joinedAt, timeZone, today);

  const [revRes, habitRes, logs] = await Promise.all([
    supabase.from("habit_revisions").select("*").eq("group_id", group.id),
    supabase
      .from("habits")
      .select("id, name, icon, color, category, weight, archived_at, is_active, sort_order, created_at, owner_id")
      .eq("group_id", group.id)
      .order("sort_order")
      .order("created_at"),
    to >= from ? fetchLogs(supabase, group.id, memberId, from, to) : Promise.resolve([]),
  ]);
  if (revRes.error) logServerError("getMemberRank:revisions", revRes.error);
  if (habitRes.error) logServerError("getMemberRank:habits", habitRes.error);

  // Sólo cuentan los hábitos comunes y los personales de este miembro.
  const memberHabits = (habitRes.data ?? []).filter((h) => h.owner_id === null || h.owner_id === memberId);
  const applies = new Set(memberHabits.map((h) => h.id));
  const revisions = toRankRevisions((revRes.data ?? []).filter((r) => applies.has(r.habit_id)));
  const rankLogs = toRankLogs(logs, timeZone);

  const result = computeRank({ from, today: to, threshold: group.streak_threshold, revisions, logs: rankLogs });
  const habits: RankHabitMeta[] = memberHabits.map((h) => ({
    id: h.id,
    name: h.name,
    icon: h.icon,
    color: h.color,
    category: h.category,
    weight: Number(h.weight),
    archived: h.archived_at !== null,
    isActive: h.is_active,
  }));
  return { result, habits };
}

export function toRankRevisions(rows: HabitRevisionRow[]): RankHabitRevision[] {
  return rows.map((r) => ({
    habitId: r.habit_id,
    effectiveFrom: r.effective_from,
    weight: Number(r.weight),
    category: r.category,
    frequency: r.frequency,
    weekdays: r.weekdays ?? [],
    weeklyTarget: r.weekly_target,
    isOptional: r.is_optional,
    isActive: r.is_active,
    archived: r.archived,
    startsOn: r.starts_on,
  }));
}

export function toRankLogs(rows: { habit_id: string; log_date: string; status: HabitLogStatus; updated_at: string }[], timeZone: string): RankLog[] {
  return rows.map((l) => ({ habitId: l.habit_id, date: l.log_date, status: l.status, recordedOn: localDateOf(l.updated_at, timeZone) }));
}

export async function fetchLogs(supabase: ServerSupabase, groupId: string, userId: string, from: IsoDate, to: IsoDate) {
  const out: { habit_id: string; log_date: string; status: HabitLogStatus; updated_at: string }[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from("habit_logs")
      .select("habit_id, log_date, status, updated_at")
      .eq("user_id", userId)
      .eq("group_id", groupId)
      .gte("log_date", from)
      .lte("log_date", to)
      .order("log_date")
      .order("habit_id")
      .range(page * LOG_PAGE, (page + 1) * LOG_PAGE - 1);
    if (error) {
      logServerError("getMemberRank:logs", error);
      break;
    }
    out.push(...(data ?? []));
    if (!data || data.length < LOG_PAGE) break;
  }
  return out;
}

/** Último rango guardado antes de hoy (lo que el usuario vio por última vez). */
export async function getPreviousSnapshot(
  supabase: ServerSupabase,
  userId: string,
  groupId: string,
  today: IsoDate,
): Promise<Pick<RankSnapshotRow, "snapshot_date" | "tier_index" | "discipline_score"> | null> {
  const { data, error } = await supabase
    .from("rank_snapshots")
    .select("snapshot_date, tier_index, discipline_score")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .lt("snapshot_date", today)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) logServerError("getPreviousSnapshot", error);
  return data ?? null;
}

/**
 * Guarda el histórico de los días que aún pueden cambiar (ventana de edición de
 * registros). Los días anteriores ya no se tocan: RLS lo impide.
 */
export async function persistRankSnapshots(
  supabase: ServerSupabase,
  userId: string,
  groupId: string,
  result: RankResult,
  today: IsoDate,
) {
  const detail = new Map(result.days.map((d) => [d.date, d]));
  const windowStart = addDays(today, -8);
  const rows = result.global.history
    .filter((p) => p.date >= windowStart && p.score !== null && p.tierIndex !== null && p.scoredDays > 0)
    .map((p) => {
      const d = detail.get(p.date);
      const categoryScores: Record<string, { score: number; tier_index: number }> = {};
      for (const [cat, scope] of Object.entries(result.categories)) {
        const cp = scope?.history.find((h) => h.date === p.date);
        if (cp?.score != null && cp.tierIndex != null) categoryScores[cat] = { score: cp.score, tier_index: cp.tierIndex };
      }
      const phase = phaseFor(p.scoredDays) as RankSnapshotRow["phase"];
      return {
        user_id: userId,
        group_id: groupId,
        snapshot_date: p.date,
        daily_score: p.dailyScore,
        discipline_score: p.score!,
        tier_index: p.tierIndex!,
        phase,
        current_streak: p.currentStreak,
        best_streak: p.bestStreak,
        consistency: p.consistency,
        category_scores: categoryScores,
        components: p.components ?? {},
        inputs: d
          ? { required: d.required, done: d.done, weights: d.weights, completed: d.completed }
          : { required: 0, done: 0, weights: {}, completed: [] },
        algorithm_version: result.version,
        computed_at: new Date().toISOString(),
      } satisfies RankSnapshotRow;
    });
  if (!rows.length) return;
  const { error } = await supabase.from("rank_snapshots").upsert(rows, { onConflict: "user_id,group_id,snapshot_date" });
  if (error) logServerError("persistRankSnapshots", error);
}
