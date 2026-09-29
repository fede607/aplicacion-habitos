import type { Metadata } from "next";
import { requireFullAccess } from "@/lib/data/session";
import { addDays, isIsoDate } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { WorkoutForm } from "@/components/workouts/workout-form";

export const metadata: Metadata = { title: "Nuevo entrenamiento" };

export default async function NewWorkoutPage({ searchParams }: PageProps<"/workouts/new">) {
  const { today } = await requireFullAccess();
  const params = await searchParams;
  const minDate = addDays(today, -60);
  const date = typeof params.date === "string" && isIsoDate(params.date) && params.date <= today && params.date >= minDate ? params.date : today;
  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Nuevo entrenamiento</h1>
      <Card>
        <CardContent className="p-4 sm:p-6">
          <WorkoutForm defaultDate={date} minDate={minDate} maxDate={today} />
        </CardContent>
      </Card>
    </div>
  );
}
