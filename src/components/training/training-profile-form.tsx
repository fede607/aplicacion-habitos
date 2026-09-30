"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, LoaderCircle, Wand2 } from "lucide-react";
import { saveTrainingProfile } from "@/app/actions/training";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export type TrainingFormValues = {
  birthYear: number;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  goal: "fat_loss" | "recomp" | "muscle" | "strength" | "endurance" | "health";
  level: "beginner" | "intermediate" | "advanced";
  trainingType: "gym" | "home_dumbbells" | "bodyweight" | "running" | "mixed";
  daysPerWeek: number;
  sessionMinutes: number;
  limitations: (
    "knee" | "lower_back" | "shoulder" | "wrist" | "hip" | "ankle"
  )[];
  focus:
    | "balanced"
    | "glutes_legs"
    | "chest_arms"
    | "back_posture"
    | "shoulders"
    | "core";
  preferredDays: number[];
};

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const STEPS = ["Tú", "Objetivo", "Entreno"] as const;

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
  cols = "flex flex-wrap",
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  cols?: string;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      <div className={cn(cols, "gap-2")}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              "rounded-2xl border px-3.5 py-2.5 text-left text-sm transition-all active:scale-[0.98]",
              value === o.value
                ? "border-primary bg-primary-soft font-semibold text-primary shadow-sm"
                : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            {o.label}
            {o.hint ? (
              <span className="block text-[11px] font-normal text-muted">
                {o.hint}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function TrainingProfileForm({
  initial,
  currentYear,
}: {
  initial: TrainingFormValues | null;
  currentYear: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
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
      focus: "balanced",
      preferredDays: [],
    },
  );
  const set = <K extends keyof TrainingFormValues>(
    k: K,
    v: TrainingFormValues[K],
  ) => setF((prev) => ({ ...prev, [k]: v }));
  const toggleLimit = (l: TrainingFormValues["limitations"][number]) =>
    set(
      "limitations",
      f.limitations.includes(l)
        ? f.limitations.filter((x) => x !== l)
        : [...f.limitations, l],
    );
  const toggleDay = (d: number) => {
    const has = f.preferredDays.includes(d);
    if (!has && f.preferredDays.length >= f.daysPerWeek)
      return toast.info(
        `Ya has elegido ${f.daysPerWeek} días. Quita uno o sube los días por semana.`,
      );
    set(
      "preferredDays",
      has ? f.preferredDays.filter((x) => x !== d) : [...f.preferredDays, d],
    );
  };
  const daysMismatch =
    f.preferredDays.length > 0 && f.preferredDays.length !== f.daysPerWeek;
  const last = step === STEPS.length - 1;

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!last) return setStep((s) => s + 1);
        if (daysMismatch)
          return toast.error(
            `Marca ${f.daysPerWeek} días o ninguno (los elegimos nosotros).`,
          );
        startTransition(async () => {
          const res = await saveTrainingProfile(f);
          if (res.ok) {
            setErrors({});
            setStep(0);
            toast.success("¡Plan listo!");
            router.refresh();
            document
              .getElementById("tu-plan")
              ?.scrollIntoView({ behavior: "smooth" });
          } else {
            setErrors(res.fieldErrors ?? {});
            if (
              res.fieldErrors &&
              ["birthYear", "heightCm", "weightKg"].some(
                (k) => res.fieldErrors?.[k],
              )
            )
              setStep(0);
            toast.error(res.error);
          }
        });
      }}
    >
      <ol className="grid grid-cols-3 gap-2" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className="grid w-full gap-1.5 text-left"
              aria-current={i === step ? "step" : undefined}
            >
              <span
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  i <= step ? "bg-primary" : "bg-surface-2",
                )}
              />
              <span
                className={cn(
                  "text-xs font-semibold",
                  i === step ? "text-foreground" : "text-muted",
                )}
              >
                {i + 1}. {s}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="grid gap-5">
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Nacimiento"
              htmlFor="tp-birth"
              error={errors.birthYear}
            >
              <Input
                id="tp-birth"
                type="number"
                inputMode="numeric"
                min={1920}
                max={2020}
                value={f.birthYear}
                onChange={(e) => set("birthYear", Number(e.target.value))}
                required
              />
            </Field>
            <Field
              label="Altura (cm)"
              htmlFor="tp-height"
              error={errors.heightCm}
            >
              <Input
                id="tp-height"
                type="number"
                inputMode="numeric"
                min={120}
                max={230}
                value={f.heightCm}
                onChange={(e) => set("heightCm", Number(e.target.value))}
                required
              />
            </Field>
            <Field
              label="Peso (kg)"
              htmlFor="tp-weight"
              error={errors.weightKg}
            >
              <Input
                id="tp-weight"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={30}
                max={250}
                value={f.weightKg}
                onChange={(e) => set("weightKg", Number(e.target.value))}
                required
              />
            </Field>
          </div>
          <Choice
            label="Sexo (para calcular tu gasto calórico)"
            value={f.sex}
            onChange={(v) => set("sex", v)}
            cols="grid grid-cols-2"
            options={[
              { value: "male", label: "Hombre" },
              { value: "female", label: "Mujer" },
            ]}
          />
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">
              ¿Alguna molestia o lesión? (opcional)
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["knee", "Rodilla"],
                  ["lower_back", "Lumbar"],
                  ["shoulder", "Hombro"],
                  ["wrist", "Muñeca"],
                  ["hip", "Cadera"],
                  ["ankle", "Tobillo"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleLimit(v)}
                  aria-pressed={f.limitations.includes(v)}
                  className={cn(
                    "rounded-2xl border px-3 py-2.5 text-sm transition-all active:scale-[0.98]",
                    f.limitations.includes(v)
                      ? "border-warning bg-warning-soft font-semibold text-warning"
                      : "border-border bg-surface hover:bg-surface-2",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              Quitamos los ejercicios que suelen molestar y te damos
              alternativas seguras.
            </p>
          </fieldset>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-5">
          <Choice
            label="Objetivo principal"
            value={f.goal}
            onChange={(v) => set("goal", v)}
            cols="grid grid-cols-2"
            options={[
              { value: "muscle", label: "💪 Ganar músculo" },
              { value: "fat_loss", label: "🔥 Perder grasa" },
              {
                value: "recomp",
                label: "✂️ Definir",
                hint: "bajar grasa y ganar músculo",
              },
              { value: "strength", label: "🏋️ Ganar fuerza" },
              { value: "endurance", label: "🫀 Resistencia" },
              { value: "health", label: "🌱 Salud y forma" },
            ]}
          />
          <Choice
            label="¿Qué zona quieres priorizar?"
            value={f.focus}
            onChange={(v) => set("focus", v)}
            cols="grid grid-cols-2"
            options={[
              { value: "balanced", label: "⚖️ Todo por igual" },
              { value: "glutes_legs", label: "🍑 Glúteo y piernas" },
              { value: "chest_arms", label: "💥 Pecho y brazos" },
              { value: "back_posture", label: "🧍 Espalda y postura" },
              { value: "shoulders", label: "🎯 Hombros" },
              { value: "core", label: "🧱 Abdomen y core" },
            ]}
          />
          <Choice
            label="Experiencia entrenando"
            value={f.level}
            onChange={(v) => set("level", v)}
            cols="grid grid-cols-3"
            options={[
              { value: "beginner", label: "Principiante", hint: "< 6 meses" },
              {
                value: "intermediate",
                label: "Intermedio",
                hint: "6 meses - 2 años",
              },
              { value: "advanced", label: "Avanzado", hint: "> 2 años" },
            ]}
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-5">
          <Choice
            label="¿Dónde y cómo entrenas?"
            value={f.trainingType}
            onChange={(v) => set("trainingType", v)}
            cols="grid grid-cols-2"
            options={[
              { value: "gym", label: "🏢 Gimnasio" },
              { value: "home_dumbbells", label: "🏠 Casa con mancuernas" },
              { value: "bodyweight", label: "🤸 Casa sin material" },
              { value: "running", label: "🏃 Running + fuerza" },
              { value: "mixed", label: "⚡ Gimnasio + cardio" },
            ]}
          />
          <Choice
            label="Días por semana"
            value={f.daysPerWeek}
            onChange={(v) => {
              set("daysPerWeek", v);
              set("preferredDays", []);
            }}
            cols="grid grid-cols-5"
            options={[2, 3, 4, 5, 6].map((d) => ({ value: d, label: `${d}` }))}
          />
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">
              ¿Qué días te vienen bien? (opcional)
            </legend>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((w, i) => {
                const d = i + 1;
                const on = f.preferredDays.includes(d);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-pressed={on}
                    aria-label={
                      [
                        "Lunes",
                        "Martes",
                        "Miércoles",
                        "Jueves",
                        "Viernes",
                        "Sábado",
                        "Domingo",
                      ][i]
                    }
                    className={cn(
                      "grid aspect-square place-items-center rounded-full border text-sm font-bold transition-all active:scale-95",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface hover:bg-surface-2",
                    )}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
            <p
              className={cn(
                "text-xs",
                daysMismatch || errors.preferredDays
                  ? "text-danger"
                  : "text-muted",
              )}
            >
              {errors.preferredDays ??
                (f.preferredDays.length
                  ? `${f.preferredDays.length} de ${f.daysPerWeek} días elegidos.`
                  : "Si no eliges, repartimos los días con descansos entre medias.")}
            </p>
          </fieldset>
          <Choice
            label="Tiempo por sesión"
            value={f.sessionMinutes}
            onChange={(v) => set("sessionMinutes", v)}
            cols="grid grid-cols-5"
            options={[30, 45, 60, 75, 90].map((m) => ({
              value: m,
              label: `${m}′`,
            }))}
          />
        </div>
      ) : null}

      <div className="flex gap-2">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="xl"
            className="px-5"
            onClick={() => setStep((s) => s - 1)}
            aria-label="Atrás"
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
        ) : null}
        {last ? (
          <Button
            type="submit"
            variant="pro"
            size="xl"
            disabled={pending}
            className="flex-1"
          >
            {pending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 aria-hidden="true" />
            )}
            {initial ? "Actualizar mi plan" : "Crear mi plan"}
          </Button>
        ) : (
          <Button type="submit" size="xl" className="flex-1">
            Siguiente <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-muted">
        🔒 Tus datos físicos son privados: sólo los ves tú.
      </p>
    </form>
  );
}
