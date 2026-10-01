"use server";

import { z } from "zod";
import { fail, type ActionResult } from "@/lib/errors";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

const reactionSchema = z.object({
  activityId: z.number().int().positive(),
  emoji: z.enum(["🔥", "💪", "👏", "🫡"]),
  on: z.boolean(),
});

export async function toggleReaction(input: z.input<typeof reactionSchema>): Promise<ActionResult> {
  const parsed = reactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { activityId, emoji, on } = parsed.data;
  const { error } = on
    ? await supabase.from("activity_reactions").insert({ activity_id: activityId, emoji })
    : await supabase.from("activity_reactions").delete().eq("activity_id", activityId).eq("user_id", userId).eq("emoji", emoji);
  // 23505: ya habías reaccionado con ese emoji (doble toque).
  if (error && error.code !== "23505") return fail(error, "toggleReaction");
  return { ok: true, data: undefined };
}
