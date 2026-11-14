"use server";

import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/errors";
import { fieldErrors, trainingProfileSchema } from "@/lib/validation";
import type { z } from "zod";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

export async function saveTrainingProfile(input: z.input<typeof trainingProfileSchema>): Promise<ActionResult> {
  const parsed = trainingProfileSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Revisa los campos.",
      fieldErrors: fieldErrors(parsed.error),
    };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const p = parsed.data;
  const { error } = await supabase.from("training_profiles").upsert(
    {
      user_id: userId,
      birth_year: p.birthYear,
      sex: p.sex,
      height_cm: p.heightCm,
      weight_kg: Math.round(p.weightKg * 10) / 10,
      goal: p.goal,
      level: p.level,
      training_type: p.trainingType,
      days_per_week: p.daysPerWeek,
      session_minutes: p.sessionMinutes,
      limitations: [...new Set(p.limitations)],
      focus: p.focus,
      preferred_days: [...new Set(p.preferredDays)].sort((a, b) => a - b),
      updated_at: new Date().toISOString(),
      // Cada guardado lleva la casilla de consentimiento marcada: se renueva la fecha.
      consent_at: new Date().toISOString(),
      consent_version: "plan-2026-11",
    },
    { onConflict: "user_id" },
  );
  if (error) return fail(error, "saveTrainingProfile");
  revalidatePath("/plan");
  return { ok: true, data: undefined };
}

/** Retira el consentimiento de datos físicos: borra tu perfil de entreno (el plan deja de calcularse). */
export async function deleteTrainingProfile(): Promise<ActionResult> {
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.from("training_profiles").delete().eq("user_id", userId);
  if (error) return fail(error, "deleteTrainingProfile");
  revalidatePath("/plan");
  return { ok: true, data: undefined };
}
