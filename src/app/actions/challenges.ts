"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/errors";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

const startSchema = z.object({
  title: z.string().trim().min(2, "Escribe el reto (mínimo 2 letras)").max(60, "Máximo 60 caracteres"),
  emoji: z.string().trim().max(16).default("🎯"),
  days: z.union([z.literal(7), z.literal(21), z.literal(30)]),
});

/** Empieza un reto personal de 7, 21 o 30 días (máximo 5 activos). */
export async function startChallenge(input: z.input<typeof startSchema>): Promise<ActionResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("start_challenge", { p_title: parsed.data.title, p_emoji: parsed.data.emoji, p_days: parsed.data.days });
  if (error) return fail(error, "startChallenge", error.code === "WA429" ? "Ya tienes 5 retos activos: termina o deja alguno antes." : undefined);
  revalidatePath("/retos");
  return { ok: true, data: undefined };
}

/** Marca o desmarca un día (hoy o ayer). Devuelve si el reto se ha completado. */
export async function toggleChallengeDay(input: { challengeId: string; day: string }): Promise<ActionResult<{ completed: boolean }>> {
  if (!/^[0-9a-f-]{36}$/i.test(input.challengeId) || !/^\d{4}-\d{2}-\d{2}$/.test(input.day)) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { data, error } = await supabase.rpc("toggle_challenge_day", { p_challenge_id: input.challengeId, p_day: input.day });
  if (error) return fail(error, "toggleChallengeDay");
  revalidatePath("/retos");
  return { ok: true, data: { completed: data === true } };
}

export async function abandonChallenge(challengeId: string): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(challengeId)) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("abandon_challenge", { p_challenge_id: challengeId });
  if (error) return fail(error, "abandonChallenge");
  revalidatePath("/retos");
  return { ok: true, data: undefined };
}

/** Crea (o reutiliza) tu espacio personal: Year Arc individual, sin grupo. */
export async function createPersonalSpace(): Promise<ActionResult> {
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("create_personal_space");
  if (error) return fail(error, "createPersonalSpace");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
