import type { Metadata } from "next";
import { AlertTriangle, Apple, CalendarDays, Dumbbell, Flame, Moon, TrendingUp } from "lucide-react";
import { requireFullAccess } from "@/lib/data/session";
import Link from "next/link";
import { planFromRow, todaysSession } from "@/lib/training/user-plan";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrainingProfileForm, type TrainingFormValues } from "@/components/training/training-profile-form";

export const metadata: Metadata = { title: "Mi plan de entrenamiento" };

const WEEKDAYS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function formatRest(sec: number) {
  return sec >= 60 ? `${Math.floor(sec / 60)}${sec % 60 ? `:${String(sec % 60).padStart(2, "0")}` : ""} min` : `${sec} s`;
}

export default async function PlanPage() {
  const { supabase, userId, today } = await requireFullAccess();
  const { data: row } = await supabase.from("training_profiles").select("*").eq("user_id", userId).maybeSingle();
  const currentYear = Number(today.slice(0, 4));

  const initial: TrainingFormValues | null = row
    ? {
        birthYear: row.birth_year,
        sex: row.sex,
        heightCm: row.height_cm,
        weightKg: Number(row.weight_kg),
        goal: row.goal,
        level: row.level,
        trainingType: row.training_type,
        daysPerWeek: row.days_per_week,
        sessionMinutes: row.session_minutes,
        limitations: row.limitations,
      }
    : null;

  const plan = row ? planFromRow(row, today) : null;
  const todayDay = plan ? todaysSession(plan, today) : null;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header>
        <p className="text-xs font-semibold tracking-widest text-ember uppercase">Pro · Entrenamiento</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tu plan personalizado</h1>
        <p className="mt-1 text-sm text-muted">Hecho a tu medida: tu físico, tu objetivo, tu material y el tiempo que tienes.</p>
      </header>

      {plan ? (
        <section id="tu-plan" className="grid gap-4 scroll-mt-20">
          <Card className="aurora">
            <CardContent className="grid gap-2 p-5">
              <h2 className="text-xl font-bold">{plan.title}</h2>
              <p className="text-sm text-muted">{plan.summary}</p>
              <p className="flex items-center gap-2 text-sm">
                <Moon className="size-4 text-muted" aria-hidden="true" /> Descanso: {plan.restDays.map((d) => WEEKDAYS[d]).join(", ")}
              </p>
            </CardContent>
          </Card>

          {todayDay ? (
            <Link href="/workouts/new?from=plan" className={buttonVariants({ variant: "pro", size: "xl", className: "w-full" })}>
              <Dumbbell aria-hidden="true" /> Hacer la sesión de hoy · {todayDay.title}
            </Link>
          ) : (
            <p className="rounded-2xl bg-surface-2 p-4 text-center text-sm">😴 Hoy toca descanso. Recuperar también es entrenar.</p>
          )}

          {plan.warnings.length > 1 ? (
            <div className="grid gap-2 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm text-foreground">
              {plan.warnings.slice(0, -1).map((w) => (
                <p key={w} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" /> {w}
                </p>
              ))}
            </div>
          ) : null}

          {plan.days.map((day) => (
            <Card key={day.weekday}>
              <CardHeader>
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <CalendarDays className="size-4 text-primary" aria-hidden="true" /> {WEEKDAYS[day.weekday]} · {day.title}
                  </CardTitle>
                  <CardDescription>Calentamiento: {day.warmup}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {day.exercises.length ? (
                  <ol className="grid gap-2">
                    {day.exercises.map((ex, i) => {
                      const timed = ex.reps.endsWith(" s");
                      return (
                        <li key={ex.name} className="rounded-xl bg-surface-2 p-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-semibold">
                              <span className="tabular mr-1.5 text-muted">{i + 1}.</span>
                              {ex.name}
                            </p>
                            <p className="tabular text-sm font-bold">
                              {ex.sets} × {ex.reps}
                            </p>
                          </div>
                          <p className="mt-0.5 text-xs text-muted">
                            Descanso {formatRest(ex.restSec)}
                            {timed ? "" : ` · RIR ${ex.rir}`}
                            {ex.note ? ` · ${ex.note}` : ""}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
                {day.cardio ? (
                  <p className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm">
                    <Flame className="mt-0.5 size-4 shrink-0 text-ember" aria-hidden="true" /> {day.cardio}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Apple className="size-4 text-success" aria-hidden="true" /> Nutrición orientativa
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Calorías/día", `${plan.nutrition.targetKcal} kcal`],
                  ["Proteína", `${plan.nutrition.proteinG} g`],
                  ["Carbohidratos", `${plan.nutrition.carbsG} g`],
                  ["Grasas", `${plan.nutrition.fatG} g`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-surface-2 p-3 text-center">
                    <p className="text-[11px] text-muted">{k}</p>
                    <p className="tabular font-bold">{v}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm">{plan.nutrition.note}</p>
              <p className="text-xs text-muted">
                Mantenimiento estimado: {plan.nutrition.maintenanceKcal} kcal · Agua: ~{plan.nutrition.waterL} L/día · IMC {plan.nutrition.bmi}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-primary" aria-hidden="true" /> Cómo progresar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid list-disc gap-1.5 pl-5 text-sm">
                {[...plan.progression, ...plan.tips].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <p className="text-xs text-muted">{plan.warnings.at(-1)}</p>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Dumbbell className="size-4 text-ember" aria-hidden="true" /> {plan ? "Tus datos" : "Cuéntanos sobre ti"}
              {plan ? <Badge tone="neutral">Actualízalos cada 4 semanas</Badge> : null}
            </CardTitle>
            <CardDescription>Con esto calculamos tus ejercicios, series, descansos y calorías.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <TrainingProfileForm initial={initial} currentYear={currentYear} />
        </CardContent>
      </Card>
    </div>
  );
}
