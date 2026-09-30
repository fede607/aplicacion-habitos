"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/errors";
import { addDays, startOfIsoWeek, todayInTimeZone } from "@/lib/dates";
import { uuidSchema } from "@/lib/validation";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

const refresh = () => revalidatePath("/group", "layout");

const createDuelSchema = z.object({
  groupId: uuidSchema,
  opponentId: uuidSchema,
  week: z.enum(["this", "next"]),
});

export async function createDuel(
  input: z.input<typeof createDuelSchema>,
): Promise<ActionResult> {
  const parsed = createDuelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single();
  const monday = startOfIsoWeek(
    todayInTimeZone(profile?.timezone ?? "Europe/Madrid"),
  );
  const { error } = await supabase.rpc("create_duel", {
    p_group_id: parsed.data.groupId,
    p_opponent_id: parsed.data.opponentId,
    p_week_start: parsed.data.week === "this" ? monday : addDays(monday, 7),
  });
  if (error) return fail(error, "createDuel");
  refresh();
  return { ok: true, data: undefined };
}

const respondSchema = z.object({ duelId: uuidSchema, accept: z.boolean() });

export async function respondDuel(
  input: z.input<typeof respondSchema>,
): Promise<ActionResult> {
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("respond_duel", {
    p_duel_id: parsed.data.duelId,
    p_accept: parsed.data.accept,
  });
  if (error) return fail(error, "respondDuel");
  refresh();
  return { ok: true, data: undefined };
}

export async function cancelDuel(duelId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(duelId);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("cancel_duel", {
    p_duel_id: parsed.data,
  });
  if (error) return fail(error, "cancelDuel");
  refresh();
  return { ok: true, data: undefined };
}

const reactionSchema = z.object({
  activityId: z.number().int().positive(),
  emoji: z.enum(["🔥", "💪", "👏", "🫡"]),
  on: z.boolean(),
});

export async function toggleReaction(
  input: z.input<typeof reactionSchema>,
): Promise<ActionResult> {
  const parsed = reactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { activityId, emoji, on } = parsed.data;
  const { error } = on
    ? await supabase
        .from("activity_reactions")
        .insert({ activity_id: activityId, emoji })
    : await supabase
        .from("activity_reactions")
        .delete()
        .eq("activity_id", activityId)
        .eq("user_id", userId)
        .eq("emoji", emoji);
  // 23505: ya habías reaccionado con ese emoji (doble toque).
  if (error && error.code !== "23505") return fail(error, "toggleReaction");
  return { ok: true, data: undefined };
}
