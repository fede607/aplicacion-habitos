import "server-only";
import type { ServerSupabase } from "../supabase/server";
import type { ActivityKind, DuelRow, ReactionEmoji } from "../database.types";
import { addDays, startOfIsoWeek, type IsoDate } from "../dates";
import { logServerError } from "../errors";
import { computeRank, localDateOf } from "../rank/engine";
import {
  duelLeader,
  duelSide,
  isDuelFinished,
  type DuelSide,
} from "../rank/duel";
import { fetchLogs, toRankLogs, toRankRevisions } from "./rank";

export const REACTIONS: ReactionEmoji[] = ["🔥", "💪", "👏", "🫡"];

export type MiniProfile = {
  id: string;
  name: string;
  emoji: string | null;
  color: string;
};

export type FeedItem = {
  id: number;
  kind: ActivityKind;
  createdAt: string;
  user: MiniProfile;
  opponent: MiniProfile | null;
  payload: Record<string, unknown>;
  reactions: { emoji: ReactionEmoji; count: number; mine: boolean }[];
};

async function profilesById(supabase: ServerSupabase, ids: string[]) {
  const map = new Map<string, MiniProfile>();
  if (!ids.length) return map;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_emoji, avatar_color")
    .in("id", [...new Set(ids)]);
  if (error) logServerError("social:profiles", error);
  for (const p of data ?? [])
    map.set(p.id, {
      id: p.id,
      name: p.display_name,
      emoji: p.avatar_emoji,
      color: p.avatar_color,
    });
  return map;
}

const UNKNOWN: MiniProfile = {
  id: "",
  name: "Alguien",
  emoji: null,
  color: "#64748b",
};

/** Feed + instante de la consulta (para los «hace 5 min» sin desajustes de hidratación). */
export async function getGroupFeed(
  supabase: ServerSupabase,
  groupId: string,
  userId: string,
  limit = 30,
) {
  return {
    items: await loadFeed(supabase, groupId, userId, limit),
    now: Date.now(),
  };
}

async function loadFeed(
  supabase: ServerSupabase,
  groupId: string,
  userId: string,
  limit: number,
): Promise<FeedItem[]> {
  const { data: rows, error } = await supabase
    .from("group_activity")
    .select("id, user_id, kind, payload, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) logServerError("getGroupFeed", error);
  const events = rows ?? [];
  if (!events.length) return [];

  const opponentIds = events
    .map((e) =>
      typeof e.payload?.opponent_id === "string"
        ? (e.payload.opponent_id as string)
        : null,
    )
    .filter((x): x is string => !!x);
  const [profiles, reactionsRes] = await Promise.all([
    profilesById(supabase, [...events.map((e) => e.user_id), ...opponentIds]),
    supabase
      .from("activity_reactions")
      .select("activity_id, user_id, emoji")
      .in(
        "activity_id",
        events.map((e) => e.id),
      ),
  ]);
  if (reactionsRes.error)
    logServerError("getGroupFeed:reactions", reactionsRes.error);

  const byEvent = new Map<
    number,
    { emoji: ReactionEmoji; user_id: string }[]
  >();
  for (const r of reactionsRes.data ?? [])
    byEvent.set(r.activity_id, [...(byEvent.get(r.activity_id) ?? []), r]);

  return events.map((e) => {
    const rs = byEvent.get(e.id) ?? [];
    const opp =
      typeof e.payload?.opponent_id === "string"
        ? (profiles.get(e.payload.opponent_id as string) ?? null)
        : null;
    return {
      id: e.id,
      kind: e.kind,
      createdAt: e.created_at,
      user: profiles.get(e.user_id) ?? UNKNOWN,
      opponent: opp,
      payload: e.payload ?? {},
      reactions: REACTIONS.map((emoji) => ({
        emoji,
        count: rs.filter((r) => r.emoji === emoji).length,
        mine: rs.some((r) => r.emoji === emoji && r.user_id === userId),
      })),
    };
  });
}

// -----------------------------------------------------------------------------
// Duelos
// -----------------------------------------------------------------------------
export type DuelView = {
  id: string;
  weekStart: IsoDate;
  status: DuelRow["status"];
  challenger: MiniProfile;
  opponent: MiniProfile;
  mine: "challenger" | "opponent" | null;
  started: boolean;
  finished: boolean;
  a: DuelSide | null;
  b: DuelSide | null;
  leader: "a" | "b" | "draw" | null;
};

type DuelGroup = {
  id: string;
  start_date: IsoDate;
  end_date: IsoDate;
  streak_threshold: number;
};

export async function getGroupDuels(
  supabase: ServerSupabase,
  opts: { group: DuelGroup; userId: string; today: IsoDate },
): Promise<DuelView[]> {
  const { group, userId, today } = opts;
  const thisWeek = startOfIsoWeek(today);
  const { data, error } = await supabase
    .from("duels")
    .select("*")
    .eq("group_id", group.id)
    .in("status", ["pending", "accepted"])
    .gte("week_start", addDays(thisWeek, -14))
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) logServerError("getGroupDuels", error);

  // Pendientes: sólo los tuyos. Aceptados: los de la semana en curso/próxima de todo
  // el grupo y los terminados en los que participaste.
  const duels = (data ?? []).filter((d) => {
    const involved = d.challenger_id === userId || d.opponent_id === userId;
    if (d.status === "pending")
      return involved && !isDuelFinished(d.week_start, today);
    return d.week_start >= thisWeek || involved;
  });
  if (!duels.length) return [];

  const participants = [
    ...new Set(duels.flatMap((d) => [d.challenger_id, d.opponent_id])),
  ];
  const profiles = await profilesById(supabase, participants);

  // Puntuaciones con el mismo motor que el rango (sólo duelos ya empezados).
  const scored = duels.filter(
    (d) => d.status === "accepted" && d.week_start <= today,
  );
  const sides = new Map<string, Map<IsoDate, DuelSide>>();
  if (scored.length) {
    const minWeek = scored.reduce(
      (m, d) => (d.week_start < m ? d.week_start : m),
      scored[0].week_start,
    );
    const to = group.end_date < today ? group.end_date : today;
    const users = [
      ...new Set(scored.flatMap((d) => [d.challenger_id, d.opponent_id])),
    ];
    const [revRes, membersRes, tzRes] = await Promise.all([
      supabase.from("habit_revisions").select("*").eq("group_id", group.id),
      supabase
        .from("group_members")
        .select("user_id, joined_at")
        .eq("group_id", group.id)
        .in("user_id", users),
      supabase.from("profiles").select("id, timezone").in("id", users),
    ]);
    const revisions = toRankRevisions(revRes.data ?? []);
    const joined = new Map(
      (membersRes.data ?? []).map((m) => [m.user_id, m.joined_at]),
    );
    const tz = new Map((tzRes.data ?? []).map((p) => [p.id, p.timezone]));
    await Promise.all(
      users.map(async (uid) => {
        const timeZone = tz.get(uid) ?? "Europe/Madrid";
        const joinedOn =
          localDateOf(joined.get(uid) ?? null, timeZone) ?? group.start_date;
        // Una semana antes del duelo para que el cupo de «no aplica» y los objetivos semanales se calculen igual que en el rango.
        let from = addDays(minWeek, -7);
        if (from < group.start_date) from = group.start_date;
        if (from < joinedOn) from = joinedOn;
        if (to < from) return;
        const logs = await fetchLogs(supabase, group.id, uid, from, to);
        const result = computeRank(
          {
            from,
            today: to,
            threshold: group.streak_threshold,
            revisions,
            logs: toRankLogs(logs, timeZone),
          },
          { detailDays: 0 },
        );
        const perWeek = new Map<IsoDate, DuelSide>();
        for (const d of scored) {
          if (d.challenger_id === uid || d.opponent_id === uid)
            perWeek.set(
              d.week_start,
              duelSide(
                result.global.history,
                d.week_start,
                to,
                group.streak_threshold,
              ),
            );
        }
        sides.set(uid, perWeek);
      }),
    );
  }

  return duels.map((d) => {
    const a = sides.get(d.challenger_id)?.get(d.week_start) ?? null;
    const b = sides.get(d.opponent_id)?.get(d.week_start) ?? null;
    return {
      id: d.id,
      weekStart: d.week_start,
      status: d.status,
      challenger: profiles.get(d.challenger_id) ?? UNKNOWN,
      opponent: profiles.get(d.opponent_id) ?? UNKNOWN,
      mine:
        d.challenger_id === userId
          ? "challenger"
          : d.opponent_id === userId
            ? "opponent"
            : null,
      started: d.week_start <= today,
      finished: isDuelFinished(d.week_start, today),
      a,
      b,
      leader: a && b ? duelLeader(a, b) : null,
    };
  });
}
