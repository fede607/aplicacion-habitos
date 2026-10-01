import "server-only";
import type { ServerSupabase } from "../supabase/server";
import type { ActivityKind, ReactionEmoji } from "../database.types";
import { logServerError } from "../errors";

export const REACTIONS: ReactionEmoji[] = ["🔥", "💪", "👏", "🫡"];

export type MiniProfile = { id: string; name: string; emoji: string | null; color: string };

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
  const { data, error } = await supabase.from("profiles").select("id, display_name, avatar_emoji, avatar_color").in("id", [...new Set(ids)]);
  if (error) logServerError("social:profiles", error);
  for (const p of data ?? []) map.set(p.id, { id: p.id, name: p.display_name, emoji: p.avatar_emoji, color: p.avatar_color });
  return map;
}

const UNKNOWN: MiniProfile = { id: "", name: "Alguien", emoji: null, color: "#64748b" };

/** Feed + instante de la consulta (para los «hace 5 min» sin desajustes de hidratación). */
export async function getGroupFeed(supabase: ServerSupabase, groupId: string, userId: string, limit = 30) {
  return { items: await loadFeed(supabase, groupId, userId, limit), now: Date.now() };
}

async function loadFeed(supabase: ServerSupabase, groupId: string, userId: string, limit: number): Promise<FeedItem[]> {
  const { data: rows, error } = await supabase
    .from("group_activity")
    .select("id, user_id, kind, payload, created_at")
    .eq("group_id", groupId)
    .neq("kind", "duel_accepted")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) logServerError("getGroupFeed", error);
  const events = rows ?? [];
  if (!events.length) return [];

  const opponentIds = events.map((e) => (typeof e.payload?.opponent_id === "string" ? (e.payload.opponent_id as string) : null)).filter((x): x is string => !!x);
  const [profiles, reactionsRes] = await Promise.all([
    profilesById(supabase, [...events.map((e) => e.user_id), ...opponentIds]),
    supabase.from("activity_reactions").select("activity_id, user_id, emoji").in("activity_id", events.map((e) => e.id)),
  ]);
  if (reactionsRes.error) logServerError("getGroupFeed:reactions", reactionsRes.error);

  const byEvent = new Map<number, { emoji: ReactionEmoji; user_id: string }[]>();
  for (const r of reactionsRes.data ?? []) byEvent.set(r.activity_id, [...(byEvent.get(r.activity_id) ?? []), r]);

  return events.map((e) => {
    const rs = byEvent.get(e.id) ?? [];
    const opp = typeof e.payload?.opponent_id === "string" ? profiles.get(e.payload.opponent_id as string) ?? null : null;
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
