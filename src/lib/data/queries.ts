import "server-only";
import type { ServerSupabase } from "../supabase/server";
import type {
  DailyStatRow,
  HabitLogRow,
  HabitLogStatus,
  HabitRow,
  WorkoutRow,
} from "../database.types";
import { logServerError } from "../errors";
import type { IsoDate } from "../dates";
import type { DayStat } from "../stats";

export async function getActiveHabits(
  supabase: ServerSupabase,
  groupId: string,
): Promise<HabitRow[]> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("group_id", groupId)
    .eq("is_active", true)
    .is("archived_at", null)
    .order("sort_order")
    .order("created_at");
  if (error) logServerError("getActiveHabits", error);
  return data ?? [];
}

export async function getAllHabits(
  supabase: ServerSupabase,
  groupId: string,
): Promise<HabitRow[]> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("group_id", groupId)
    .is("archived_at", null)
    .order("sort_order")
    .order("created_at");
  if (error) logServerError("getAllHabits", error);
  return data ?? [];
}

export async function getMyLogs(
  supabase: ServerSupabase,
  userId: string,
  groupId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<Pick<HabitLogRow, "habit_id" | "log_date" | "status">[]> {
  const { data, error } = await supabase
    .from("habit_logs")
    .select("habit_id, log_date, status")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .gte("log_date", from)
    .lte("log_date", to);
  if (error) logServerError("getMyLogs", error);
  return data ?? [];
}

/** Índice habit_id -> (fecha -> estado). */
export function indexLogs(
  logs: Pick<HabitLogRow, "habit_id" | "log_date" | "status">[],
) {
  const map = new Map<string, Map<IsoDate, HabitLogStatus>>();
  for (const l of logs) {
    let inner = map.get(l.habit_id);
    if (!inner) map.set(l.habit_id, (inner = new Map()));
    inner.set(l.log_date, l.status);
  }
  return map;
}

export async function getDailyStats(
  supabase: ServerSupabase,
  groupId: string,
  from: IsoDate,
  to: IsoDate,
  userId?: string,
): Promise<DailyStatRow[]> {
  if (to < from) return [];
  const { data, error } = await supabase.rpc("daily_stats", {
    p_group_id: groupId,
    p_from: from,
    p_to: to,
    p_user_id: userId ?? null,
  });
  if (error) logServerError("getDailyStats", error);
  return data ?? [];
}

export function toDayStats(rows: DailyStatRow[]): DayStat[] {
  return rows.map(({ day, required, completed, skipped, bonus }) => ({
    day,
    required,
    completed,
    skipped,
    bonus,
  }));
}

export async function getWorkoutTotals(
  supabase: ServerSupabase,
  userId: string,
  from?: IsoDate,
  to?: IsoDate,
): Promise<{ count: number; minutes: number }> {
  let query = supabase
    .from("workouts")
    .select("duration_min")
    .eq("user_id", userId);
  if (from) query = query.gte("workout_date", from);
  if (to) query = query.lte("workout_date", to);
  const { data, error } = await query.limit(5000);
  if (error) logServerError("getWorkoutTotals", error);
  const rows = data ?? [];
  return {
    count: rows.length,
    minutes: rows.reduce((acc, r) => acc + r.duration_min, 0),
  };
}

export const WORKOUTS_PAGE_SIZE = 15;

export async function getWorkoutsPage(
  supabase: ServerSupabase,
  userId: string,
  page: number,
): Promise<{ items: WorkoutRow[]; hasMore: boolean }> {
  const from = page * WORKOUTS_PAGE_SIZE;
  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + WORKOUTS_PAGE_SIZE);
  if (error) logServerError("getWorkoutsPage", error);
  const rows = data ?? [];
  return {
    items: rows.slice(0, WORKOUTS_PAGE_SIZE),
    hasMore: rows.length > WORKOUTS_PAGE_SIZE,
  };
}

export async function getXpInputs(supabase: ServerSupabase, userId: string) {
  const [done, workouts, notes, achievements] = await Promise.all([
    supabase
      .from("habit_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "done"),
    supabase
      .from("workouts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("daily_entries")
      .select("entry_date", { count: "exact", head: true })
      .eq("user_id", userId)
      .or("did_today.neq.,improve_tomorrow.neq."),
    supabase
      .from("user_achievements")
      .select("achievement_code")
      .eq("user_id", userId),
  ]);
  return {
    habitsDone: done.count ?? 0,
    workouts: workouts.count ?? 0,
    noteDays: notes.count ?? 0,
    unlockedCodes: (achievements.data ?? []).map((a) => a.achievement_code),
  };
}
