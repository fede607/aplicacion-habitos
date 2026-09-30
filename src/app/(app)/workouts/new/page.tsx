import type { Metadata } from "next";
import { requireFullAccess } from "@/lib/data/session";
import { addDays, isIsoDate } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import {
  WorkoutForm,
  type WorkoutPrefill,
} from "@/components/workouts/workout-form";
import { applyPhase, cyclePhase } from "@/lib/training/engine";
import {
  loadTrainingProfile,
  planFromRow,
  sessionPrefill,
  todaysSession,
} from "@/lib/training/user-plan";

export const metadata: Metadata = { title: "Nuevo entrenamiento" };

export default async function NewWorkoutPage({
  searchParams,
}: PageProps<"/workouts/new">) {
  const { supabase, userId, today } = await requireFullAccess();
  const params = await searchParams;
  const minDate = addDays(today, -60);
  const date =
    typeof params.date === "string" &&
    isIsoDate(params.date) &&
    params.date <= today &&
    params.date >= minDate
      ? params.date
      : today;
  // Desde el plan: se rellena con la sesión de hoy (se puede editar antes de guardar).
  let prefill: WorkoutPrefill | undefined;
  if (params.from === "plan") {
    const row = await loadTrainingProfile(supabase, userId);
    const day = row ? todaysSession(planFromRow(row, today), today) : null;
    if (row && day)
      prefill = sessionPrefill(
        applyPhase(day, cyclePhase(row.updated_at, today)),
        row,
      );
  }
  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <h1 className="text-2xl font-bold tracking-tight">
        {prefill ? "Sesión de hoy (de tu plan)" : "Nuevo entrenamiento"}
      </h1>
      {prefill ? (
        <p className="-mt-4 text-sm text-muted">
          Ya está rellena con tu plan. Ajusta pesos o repeticiones reales y
          guarda.
        </p>
      ) : null}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <WorkoutForm
            defaultDate={date}
            minDate={minDate}
            maxDate={today}
            prefill={prefill}
          />
        </CardContent>
      </Card>
    </div>
  );
}
