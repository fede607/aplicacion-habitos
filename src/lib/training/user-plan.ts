import "server-only";
import type { ServerSupabase } from "../supabase/server";
import type { TrainingProfileRow, WorkoutType } from "../database.types";
import { isoWeekday, type IsoDate } from "../dates";
import { generatePlan } from "./engine";
import type { PlannedDay, TrainingPlan } from "./types";

export function planFromRow(row: TrainingProfileRow, today: IsoDate): TrainingPlan {
  return generatePlan({
    age: Number(today.slice(0, 4)) - row.birth_year,
    sex: row.sex,
    heightCm: row.height_cm,
    weightKg: Number(row.weight_kg),
    goal: row.goal,
    level: row.level,
    trainingType: row.training_type,
    daysPerWeek: row.days_per_week,
    sessionMinutes: row.session_minutes,
    limitations: row.limitations,
  });
}

export async function loadTrainingProfile(supabase: ServerSupabase, userId: string): Promise<TrainingProfileRow | null> {
  const { data } = await supabase.from("training_profiles").select("*").eq("user_id", userId).maybeSingle();
  return data ?? null;
}

/** Sesión del plan para hoy (o null si hoy toca descanso). */
export function todaysSession(plan: TrainingPlan, today: IsoDate): PlannedDay | null {
  return plan.days.find((d) => d.weekday === isoWeekday(today)) ?? null;
}

/** Texto y tipo para rellenar el formulario de entrenamiento con la sesión de hoy. */
export function sessionPrefill(day: PlannedDay, row: TrainingProfileRow): { type: WorkoutType; durationMin: number; exercises: string } {
  const lines = day.exercises.map((e) => `${e.name} — ${e.sets}×${e.reps}${e.reps.endsWith(" s") ? "" : ` (RIR ${e.rir})`}`);
  if (day.cardio) lines.push(day.cardio);
  const type: WorkoutType = day.exercises.length ? "gym" : day.focus === "recuperación activa" ? "mobility" : "cardio";
  return { type, durationMin: row.session_minutes, exercises: `${day.title}\n${lines.join("\n")}`.slice(0, 2000) };
}
