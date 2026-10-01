import type { Metadata } from "next";
import { ProLocked } from "@/components/pro/pro-locked";
import { notFound } from "next/navigation";
import { requireProPage } from "@/lib/data/session";
import { addDays } from "@/lib/dates";
import { uuidSchema } from "@/lib/validation";
import { Card, CardContent } from "@/components/ui/card";
import { WorkoutForm } from "@/components/workouts/workout-form";

export const metadata: Metadata = { title: "Editar entrenamiento" };

export default async function EditWorkoutPage({ params }: PageProps<"/workouts/[id]">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const gate = await requireProPage();
  if (!gate) return <ProLocked feature="workouts" />;
  const { supabase, userId, today } = gate;
  // RLS garantiza que sólo se devuelven entrenamientos propios.
  const { data: workout } = await supabase.from("workouts").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!workout) notFound();
  const minDate = addDays(today, -60);
  const editable = workout.workout_date >= minDate;
  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Editar entrenamiento</h1>
      {!editable ? <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">Los entrenamientos de hace más de 60 días ya no se pueden editar.</p> : null}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <WorkoutForm workout={workout} defaultDate={workout.workout_date} minDate={minDate} maxDate={today} />
        </CardContent>
      </Card>
    </div>
  );
}
