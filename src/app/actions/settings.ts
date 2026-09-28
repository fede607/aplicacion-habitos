"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/errors";
import { fieldErrors, preferencesSchema, profileSchema } from "@/lib/validation";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los campos.", fieldErrors: fieldErrors(parsed.error) };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const p = parsed.data;

  const { data: available } = await supabase.rpc("username_available", { p_username: p.username });
  if (available === false) {
    return { ok: false, error: "Revisa los campos.", fieldErrors: { username: "Ese nombre de usuario ya está cogido." } };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: p.displayName,
      username: p.username,
      avatar_emoji: p.avatarEmoji,
      avatar_color: p.avatarColor,
      timezone: p.timezone,
    })
    .eq("id", userId);
  if (error) return fail(error, "updateProfile");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function updatePreferences(input: z.input<typeof preferencesSchema>): Promise<ActionResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los campos.", fieldErrors: fieldErrors(parsed.error) };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const s = parsed.data;
  const { error } = await supabase
    .from("user_settings")
    .update({
      share_habits: s.shareHabits,
      share_workouts: s.shareWorkouts,
      show_in_comparison: s.showInComparison,
      reminder_enabled: s.reminderEnabled,
      reminder_time: s.reminderTime,
    })
    .eq("user_id", userId);
  if (error) return fail(error, "updatePreferences");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function updateTimezone(timezone: string): Promise<ActionResult> {
  const parsed = profileSchema.shape.timezone.safeParse(timezone);
  if (!parsed.success) return { ok: false, error: "Zona horaria no válida." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.from("profiles").update({ timezone: parsed.data }).eq("id", userId);
  if (error) return fail(error, "updateTimezone");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  if (confirmation !== "BORRAR") return { ok: false, error: 'Escribe "BORRAR" para confirmar.' };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return fail(error, "deleteAccount", "No se ha podido borrar la cuenta. Inténtalo de nuevo.");
  await supabase.auth.signOut();
  redirect("/?account=deleted");
}
