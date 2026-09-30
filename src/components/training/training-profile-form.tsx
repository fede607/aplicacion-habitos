"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, Wand2 } from "lucide-react";
import { saveTrainingProfile } from "@/app/actions/training";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export type TrainingFormValues = {
  birthYear: number;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  goal: "fat_loss" | "muscle" | "strength" | "endurance" | "health";
  level: "beginner" | "intermediate" | "advanced";
  trainingType: "gym" | "home_dumbbells" | "bodyweight" | "running" | "mixed";
  daysPerWeek: number;
  sessionMinutes: number;
  limitations: ("knee" | "lower_back" | "shoulder")[];
};

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
              value === o.value ? "border-primary bg-primary-soft font-semibold text-primary" : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            {o.label}
            {o.hint ? <span className="block text-[11px] font-normal text-muted">{o.hint}</span> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function TrainingProfileForm({ initial, currentYear }: { initial: TrainingFormValues | null; currentYear: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState<TrainingFormValues>(
    initial ?? {
      birthYear: currentYear - 16,
      sex: "male",
      heightCm: 170,
      weightKg: 65,
      goal: "muscle",
      level: "beginner",
      trainingType: "gym",
      daysPerWeek: 3,
      sessionMinutes: 60,
      limitations: [],
    },
  );
  const set = <K extends keyof TrainingFormValues>(k: K, v: TrainingFormValues[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const toggleLimit = (l: TrainingFormValues["limitations"][number]) =>
    set("limitations", f.limitations.includes(l) ? f.limitations.filter((x) => x !== l) : [...f.limitations, l]);

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveTrainingProfile(f);
          if (res.ok) {
            setErrors({});
            toast.success("¡Plan generado!");
            router.refresh();
            document.getElementById("tu-plan")?.scrollIntoView({ behavior: "smooth" });
          } else {
            setErrors(res.fieldErrors ?? {});
            toast.error(res.error);
          }
        });
      }}
    >
      <div className="grid grid-cols-3 gap-3">
        <Field label="Año de nacimiento" htmlFor="tp-birth" error={errors.birthYear}>
          <Input id="tp-birth" type="number" inputMode="numeric" min={1920} max={2020} value={f.birthYear} onChange={(e) => set("birthYear", Number(e.target.value))} required />
        </Field>
        <Field label="Altura (cm)" htmlFor="tp-height" error={errors.heightCm}>
          <Input id="tp-height" type="number" inputMode="numeric" min={120} max={230} value={f.heightCm} onChange={(e) => set("heightCm", Number(e.target.value))} required />
        </Field>
        <Field label="Peso (kg)" htmlFor="tp-weight" error={errors.weightKg}>
          <Input id="tp-weight" type="number" inputMode="decimal" step="0.1" min={30} max={250} value={f.weightKg} onChange={(e) => set("weightKg", Number(e.target.value))} required />
        </Field>
      </div>

      <Choice
        label="Sexo (para calcular tu gasto calórico)"
        value={f.sex}
        onChange={(v) => set("sex", v)}
        options={[
          { value: "male", label: "Hombre" },
          { value: "female", label: "Mujer" },
        ]}
      />
      <Choice
        label="Objetivo principal"
        value={f.goal}
        onChange={(v) => set("goal", v)}
        options={[
          { value: "muscle", label: "💪 Ganar músculo" },
          { value: "fat_loss", label: "🔥 Perder grasa" },
          { value: "strength", label: "🏋️ Ganar fuerza" },
          { value: "endurance", label: "🫀 Resistencia" },
          { value: "health", label: "🌱 Salud y forma" },
        ]}
      />
      <Choice
        label="Experiencia entrenando"
        value={f.level}
        onChange={(v) => set("level", v)}
        options={[
          { value: "beginner", label: "Principiante", hint: "menos de 6 meses" },
          { value: "intermediate", label: "Intermedio", hint: "6 meses - 2 años" },
          { value: "advanced", label: "Avanzado", hint: "más de 2 años" },
        ]}
      />
      <Choice
        label="¿Dónde y cómo entrenas?"
        value={f.trainingType}
        onChange={(v) => set("trainingType", v)}
        options={[
          { value: "gym", label: "Gimnasio" },
          { value: "home_dumbbells", label: "Casa con mancuernas" },
          { value: "bodyweight", label: "Casa sin material" },
          { value: "running", label: "Running + fuerza" },
          { value: "mixed", label: "Gimnasio + cardio" },
        ]}
      />
      <Choice
        label="Días por semana"
        value={f.daysPerWeek}
        onChange={(v) => set("daysPerWeek", v)}
        options={[2, 3, 4, 5, 6].map((d) => ({ value: d, label: `${d} días` }))}
      />
      <Choice
        label="Tiempo por sesión"
        value={f.sessionMinutes}
        onChange={(v) => set("sessionMinutes", v)}
        options={[30, 45, 60, 75, 90].map((m) => ({ value: m, label: `${m} min` }))}
      />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">¿Alguna molestia o lesión? (opcional)</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["knee", "Rodilla"],
              ["lower_back", "Zona lumbar"],
              ["shoulder", "Hombro"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => toggleLimit(v)}
              aria-pressed={f.limitations.includes(v)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm",
                f.limitations.includes(v) ? "border-warning bg-warning-soft font-semibold text-warning" : "border-border bg-surface hover:bg-surface-2",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <Button type="submit" variant="pro" size="xl" disabled={pending} className="w-full">
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Wand2 aria-hidden="true" />}
        {initial ? "Actualizar mi plan" : "Crear mi plan"}
      </Button>
      <p className="text-xs text-muted">Tus datos físicos son privados: sólo los ves tú, nunca se comparten con el grupo.</p>
    </form>
  );
}
