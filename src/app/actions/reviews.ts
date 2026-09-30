"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/errors";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(280, "Máximo 280 caracteres"),
  allowPublic: z.boolean(),
});

/** Guarda (o actualiza) la opinión del usuario. Si la edita, vuelve a revisión. */
export async function saveReview(input: z.input<typeof reviewSchema>): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { rating, body, allowPublic } = parsed.data;
  const { data: existing } = await supabase.from("reviews").select("id").eq("user_id", userId).maybeSingle();
  const { error } = existing
    ? await supabase.from("reviews").update({ rating, body, allow_public: allowPublic }).eq("user_id", userId)
    : await supabase.from("reviews").insert({ user_id: userId, rating, body, allow_public: allowPublic });
  if (error) return fail(error, "saveReview");
  revalidatePath("/today");
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

/** Staff: aprobar o retirar una opinión de la web. */
export async function staffSetReviewApproved(input: { reviewId: string; approved: boolean }): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(input.reviewId)) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("staff_set_review_approved", { p_review_id: input.reviewId, p_approved: input.approved });
  if (error) return fail(error, "staffSetReviewApproved");
  revalidatePath("/pro/pagos");
  revalidatePath("/");
  revalidatePath("/register");
  return { ok: true, data: undefined };
}
