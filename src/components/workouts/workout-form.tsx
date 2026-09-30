"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, Trash2 } from "lucide-react";
import { deleteWorkout, saveWorkout } from "@/app/actions/tracking";
import { WORKOUT_TYPES } from "@/lib/validation";
import { WORKOUT_EMOJI, WORKOUT_LABELS } from "@/lib/labels";
import type { WorkoutRow, WorkoutType } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FormState = {
  date: string;
  type: WorkoutType;
  durationMin: string;
  intensity: string;
  feeling: string;
  exercises: string;
  notes: string;
  nextGoal: string;
};

export type WorkoutPrefill = {
  type: WorkoutType;
  durationMin: number;
  exercises: string;
};

export function WorkoutForm({
  workout,
  defaultDate,
  minDate,
  maxDate,
  prefill,
}: {
  workout?: WorkoutRow;
  defaultDate: string;
  minDate: string;
  maxDate: string;
  prefill?: WorkoutPrefill;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormState>({
    date: workout?.workout_date ?? defaultDate,
    type: workout?.type ?? prefill?.type ?? "gym",
    durationMin: String(workout?.duration_min ?? prefill?.durationMin ?? 60),
    intensity: workout?.intensity ? String(workout.intensity) : "",
    feeling: workout?.feeling ? String(workout.feeling) : "",
    exercises: workout?.exercises ?? prefill?.exercises ?? "",
    notes: workout?.notes ?? "",
    nextGoal: workout?.next_goal ?? "",
  });
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          try {
            const res = await saveWorkout({ ...form, id: workout?.id });
            if (res.ok) {
              toast.success("Entrenamiento guardado ✓");
              router.push("/workouts");
            } else {
              setErrors(res.fieldErrors ?? {});
              toast.error(res.error);
            }
          } catch {
            toast.error("Sin conexión. No se ha guardado: inténtalo de nuevo.");
          }
        });
      }}
    >
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Tipo</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {WORKOUT_TYPES.map((t) => (
            <label
              key={t}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-border bg-surface p-3 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                form.type === t &&
                  "border-primary bg-primary-soft text-primary",
              )}
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={form.type === t}
                onChange={() => set("type", t)}
                className="sr-only"
              />
              <span className="text-xl" aria-hidden="true">
                {WORKOUT_EMOJI[t]}
              </span>
              {WORKOUT_LABELS[t]}
            </label>
          ))}
        </div>
        {errors.type ? (
          <p className="text-sm text-danger">{errors.type}</p>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" htmlFor="w-date" error={errors.date}>
          <Input
            id="w-date"
            type="date"
            value={form.date}
            min={minDate}
            max={maxDate}
            onChange={(e) => set("date", e.target.value)}
            required
          />
        </Field>
        <Field
          label="Duración (min)"
          htmlFor="w-duration"
          error={errors.durationMin}
        >
          <Input
            id="w-duration"
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            value={form.durationMin}
            onChange={(e) => set("durationMin", e.target.value)}
            required
            aria-invalid={!!errors.durationMin}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ScalePicker
          id="w-feeling"
          label="Sensación"
          value={form.feeling}
          onChange={(v) => set("feeling", v)}
          error={errors.feeling}
        />
        <ScalePicker
          id="w-intensity"
          label="Intensidad (opcional)"
          value={form.intensity}
          onChange={(v) => set("intensity", v)}
          error={errors.intensity}
        />
      </div>

      <Field
        label="Ejercicios realizados"
        htmlFor="w-exercises"
        error={errors.exercises}
      >
        <Textarea
          id="w-exercises"
          value={form.exercises}
          maxLength={2000}
          placeholder="Ej.: 5×5 sentadilla 80 kg, 3×10 dominadas…"
          onChange={(e) => set("exercises", e.target.value)}
        />
      </Field>
      <Field label="Observaciones" htmlFor="w-notes" error={errors.notes}>
        <Textarea
          id="w-notes"
          value={form.notes}
          maxLength={2000}
          placeholder="Ej.: Buenas sensaciones, subí peso en sentadilla."
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>
      <Field
        label="Objetivo del siguiente entrenamiento"
        htmlFor="w-next"
        error={errors.nextGoal}
      >
        <Input
          id="w-next"
          value={form.nextGoal}
          maxLength={500}
          placeholder="Ej.: Subir 2,5 kg en press banca"
          onChange={(e) => set("nextGoal", e.target.value)}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="flex-1 sm:flex-none"
        >
          {pending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : null}
          Guardar
        </Button>
        {workout ? <DeleteWorkoutButton id={workout.id} /> : null}
      </div>
    </form>
  );
}

function ScalePicker({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend id={id} className="text-sm font-medium">
        {label}{" "}
        {value ? (
          <span className="tabular text-primary">{value}/10</span>
        ) : null}
      </legend>
      <div
        className="grid grid-cols-10 gap-1"
        role="radiogroup"
        aria-labelledby={id}
      >
        {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} de 10`}
            onClick={() => onChange(value === n ? "" : n)}
            className={cn(
              "tabular h-10 rounded-lg border border-border bg-surface text-sm font-semibold transition-colors hover:bg-surface-2",
              value === n &&
                "border-primary bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </fieldset>
  );
}

function DeleteWorkoutButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      className="text-danger"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm("¿Borrar este entrenamiento? No se puede deshacer.")
        )
          return;
        startTransition(async () => {
          const res = await deleteWorkout(id);
          if (res.ok) {
            toast.success("Entrenamiento borrado");
            router.push("/workouts");
          } else toast.error(res.error);
        });
      }}
    >
      <Trash2 aria-hidden="true" />
      Borrar
    </Button>
  );
}
