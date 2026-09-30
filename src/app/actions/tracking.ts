"use server";

import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/errors";
import {
  dailyEntrySchema,
  fieldErrors,
  habitStatusSchema,
  uuidSchema,
  workoutSchema,
} from "@/lib/validation";
import type { HabitLogStatus, WorkoutRow } from "@/lib/database.types";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

/** Guarda (o borra, con status=null) el estado de un hábito para un día. */
export async function setHabitStatus(input: {
  habitId: string;
  date: string;
  status: HabitLogStatus | null;
}): Promise<ActionResult<{ status: HabitLogStatus | null }>> {
  const parsed = habitStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;

  const { error } = await supabase.rpc("set_habit_status", {
    p_habit_id: parsed.data.habitId,
    p_date: parsed.data.date,
    p_status: parsed.data.status,
  });
  if (error) return fail(error, "setHabitStatus");
  return { ok: true, data: { status: parsed.data.status } };
}

/**
 * Guarda las notas del día con control de concurrencia optimista: si la fila
 * cambió en otro dispositivo/pestaña desde que se cargó, no se sobrescribe.
 */
export async function saveDailyEntry(input: {
  date: string;
  didToday: string;
  improveTomorrow: string;
  expectedUpdatedAt: string | null;
}): Promise<
  ActionResult<{ updatedAt: string }> & {
    conflict?: { didToday: string; improveTomorrow: string; updatedAt: string };
  }
> {
  const parsed = dailyEntrySchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Revisa las notas.",
      fieldErrors: fieldErrors(parsed.error),
    };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { date, didToday, improveTomorrow, expectedUpdatedAt } = parsed.data;

  const { data: current, error: readError } = await supabase
    .from("daily_entries")
    .select("did_today, improve_tomorrow, updated_at")
    .eq("user_id", userId)
    .eq("entry_date", date)
    .maybeSingle();
  if (readError) return fail(readError, "saveDailyEntry:read");

  if (!current) {
    const { data, error } = await supabase
      .from("daily_entries")
      .insert({
        user_id: userId,
        entry_date: date,
        did_today: didToday,
        improve_tomorrow: improveTomorrow,
      })
      .select("updated_at")
      .single();
    if (error?.code === "23505") {
      return saveDailyEntry({ ...parsed.data, expectedUpdatedAt: null }); // carrera entre pestañas
    }
    if (error || !data) return fail(error, "saveDailyEntry:insert");
    return { ok: true, data: { updatedAt: data.updated_at } };
  }

  const sameTimestamp =
    expectedUpdatedAt !== null &&
    new Date(current.updated_at).getTime() ===
      new Date(expectedUpdatedAt).getTime();
  const sameContent =
    current.did_today === didToday &&
    current.improve_tomorrow === improveTomorrow;
  if (sameContent) return { ok: true, data: { updatedAt: current.updated_at } };
  if (!sameTimestamp) {
    return {
      ok: false,
      error: "Estas notas se han modificado en otro dispositivo.",
      code: "conflict",
      conflict: {
        didToday: current.did_today,
        improveTomorrow: current.improve_tomorrow,
        updatedAt: current.updated_at,
      },
    };
  }

  const { data, error } = await supabase
    .from("daily_entries")
    .update({ did_today: didToday, improve_tomorrow: improveTomorrow })
    .eq("user_id", userId)
    .eq("entry_date", date)
    .eq("updated_at", current.updated_at)
    .select("updated_at");
  if (error) return fail(error, "saveDailyEntry:update");
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "Estas notas se han modificado en otro dispositivo.",
      code: "conflict",
    };
  }
  return { ok: true, data: { updatedAt: data[0].updated_at } };
}

export async function saveWorkout(
  input: Record<string, unknown>,
): Promise<ActionResult<WorkoutRow>> {
  const parsed = workoutSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Revisa los campos.",
      fieldErrors: fieldErrors(parsed.error),
    };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const w = parsed.data;
  const row = {
    workout_date: w.date,
    type: w.type,
    duration_min: w.durationMin,
    intensity: w.intensity,
    feeling: w.feeling,
    exercises: w.exercises,
    notes: w.notes,
    next_goal: w.nextGoal,
  };

  const query = w.id
    ? supabase
        .from("workouts")
        .update(row)
        .eq("id", w.id)
        .eq("user_id", userId)
        .select()
        .single()
    : supabase
        .from("workouts")
        .insert({ ...row, user_id: userId })
        .select()
        .single();
  const { data, error } = await query;
  if (error || !data) return fail(error, "saveWorkout");
  revalidatePath("/workouts");
  revalidatePath("/dashboard");
  return { ok: true, data };
}

export async function deleteWorkout(id: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase
    .from("workouts")
    .delete()
    .eq("id", parsed.data)
    .eq("user_id", userId);
  if (error) return fail(error, "deleteWorkout");
  revalidatePath("/workouts");
  return { ok: true, data: undefined };
}
