import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Apple, ChevronDown, Clock, Dumbbell, Flame, Moon, Repeat2, Settings2, Star, TrendingUp } from "lucide-react";
import { requireFullAccess } from "@/lib/data/session";
import { planFromRow, todaysSession } from "@/lib/training/user-plan";
import { applyPhase, cyclePhase, FOCUS_LABELS } from "@/lib/training/engine";
import { isoWeekday } from "@/lib/dates";
import type { PlannedDay } from "@/lib/training/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrainingProfileForm, type TrainingFormValues } from "@/components/training/training-profile-form";

export const metadata: Metadata = { title: "Mi plan de entrenamiento" };

const WEEKDAYS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const SHORT = ["", "L", "M", "X", "J", "V", "S", "D"];

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
        focus: row.focus ?? "balanced",
        preferredDays: row.preferred_days ?? [],
      }
    : null;

  const plan = row ? planFromRow(row, today) : null;
  const phase = row ? cyclePhase(row.updated_at, today) : null;
  const todayRaw = plan ? todaysSession(plan, today) : null;
  const todayDay = todayRaw && phase ? applyPhase(todayRaw, phase) : null;
  const todayNum = isoWeekday(today);

  if (!plan || !phase) {
    return (
      <div className="mx-auto grid max-w-xl gap-6">
        <header className="grid gap-2 text-center">
          <p className="text-xs font-bold tracking-widest text-ember uppercase">Entreno personalizado</p>
          <h1 className="text-3xl font-black tracking-tight">Tu plan en 1 minuto</h1>
          <p className="text-sm text-muted">3 pasos. Ejercicios, series, descansos y calorías hechos para tu cuerpo, tu objetivo y tu material.</p>
        </header>
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-card">
          <TrainingProfileForm initial={null} currentYear={currentYear} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      {/* Cabecera del plan */}
      <section id="tu-plan" className="aurora scroll-mt-20 overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-card">
        <p className="text-xs font-bold tracking-widest text-ember uppercase">{phase.label}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{plan.title}</h1>
        <p className="mt-1 text-sm text-muted">{plan.summary}</p>
        {row?.focus && row.focus !== "balanced" ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <Star className="size-3.5" aria-hidden="true" /> Prioridad: {FOCUS_LABELS[row.focus]}
          </p>
        ) : null}
        <p className="mt-3 rounded-2xl bg-background/60 p-3 text-sm">💡 {phase.tip}</p>

        {/* Semana */}
        <ol className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Tu semana">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const day = plan.days.find((x) => x.weekday === d);
            return (
              <li key={d}>
                <a
                  href={day ? `#dia-${d}` : undefined}
                  className={cn(
                    "grid place-items-center gap-0.5 rounded-2xl py-2 text-xs font-bold",
                    day ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted",
                    d === todayNum && "ring-2 ring-primary ring-offset-2 ring-offset-surface",
                  )}
                >
                  <span>{SHORT[d]}</span>
                  <span aria-hidden="true">{day ? (day.exercises.length ? "💪" : day.focus === "carrera" ? "🏃" : "🫀") : "😴"}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Hoy */}
      {todayDay ? (
        <section className="grid gap-3 rounded-3xl border-2 border-primary/40 bg-surface p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-widest text-primary uppercase">Hoy toca</p>
              <h2 className="text-xl font-black">{todayDay.title}</h2>
              <p className="text-sm text-muted first-letter:uppercase">{todayDay.focus}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold">
              <Clock className="size-4" aria-hidden="true" /> ~{todayDay.estMinutes} min
            </span>
          </div>
          <Link
            href="/workouts/new?from=plan"
            className={buttonVariants({
              variant: "pro",
              size: "xl",
              className: "w-full",
            })}
          >
            <Dumbbell aria-hidden="true" /> Empezar sesión
          </Link>
        </section>
      ) : (
        <p className="rounded-3xl bg-surface-2 p-5 text-center text-sm">😴 Hoy toca descanso. Recuperar también es entrenar: camina, estira y duerme bien.</p>
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

      {/* Días */}
      <section className="grid gap-3" aria-label="Sesiones de la semana">
        {plan.days.map((raw) => {
          const day = applyPhase(raw, phase);
          return <DayCard key={day.weekday} day={day} open={day.weekday === todayNum} />;
        })}
        <p className="flex items-center gap-2 px-1 text-sm text-muted">
          <Moon className="size-4" aria-hidden="true" /> Descanso: {plan.restDays.map((d) => WEEKDAYS[d]).join(", ")}
        </p>
      </section>

      {/* Nutrición */}
      <section className="grid gap-3 rounded-3xl border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <Apple className="size-5 text-success" aria-hidden="true" /> Nutrición orientativa
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {[
            ["kcal", plan.nutrition.targetKcal],
            ["Proteína", `${plan.nutrition.proteinG} g`],
            ["Carbos", `${plan.nutrition.carbsG} g`],
            ["Grasas", `${plan.nutrition.fatG} g`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-surface-2 p-2.5 text-center">
              <p className="tabular text-base font-black sm:text-lg">{v}</p>
              <p className="text-[11px] text-muted">{k}</p>
            </div>
          ))}
        </div>
        <p className="text-sm">{plan.nutrition.note}</p>
        <p className="text-xs text-muted">
          Mantenimiento ~{plan.nutrition.maintenanceKcal} kcal · Agua ~{plan.nutrition.waterL} L/día · IMC {plan.nutrition.bmi}
        </p>
      </section>

      <Collapsible icon={<TrendingUp className="size-5 text-primary" aria-hidden="true" />} title="Cómo progresar">
        <ul className="grid list-disc gap-1.5 pl-5 text-sm">
          {[...plan.progression, ...plan.tips].map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Collapsible>

      <Collapsible icon={<Settings2 className="size-5 text-ember" aria-hidden="true" />} title="Cambiar mis datos u objetivo">
        <TrainingProfileForm initial={initial} currentYear={currentYear} />
      </Collapsible>

      <p className="px-1 text-xs text-muted">{plan.warnings.at(-1)}</p>
    </div>
  );
}

function Collapsible({ icon, title, children, open }: { icon: React.ReactNode; title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-3xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-5 font-bold [&::-webkit-details-marker]:hidden">
        {icon} {title}
        <ChevronDown className="ml-auto size-5 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}

function DayCard({ day, open }: { day: PlannedDay; open: boolean }) {
  return (
    <details id={`dia-${day.weekday}`} open={open} className="group scroll-mt-20 rounded-3xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-2xl text-sm font-black",
            open ? "bg-primary text-primary-foreground" : "bg-surface-2",
          )}
        >
          {SHORT[day.weekday]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{day.title}</span>
          <span className="block truncate text-xs text-muted">
            {WEEKDAYS[day.weekday]} · {day.exercises.length ? `${day.exercises.length} ejercicios` : "cardio"} · ~{day.estMinutes} min
          </span>
        </span>
        <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-2 px-4 pb-4">
        <p className="text-xs text-muted">🔥 Calentamiento: {day.warmup}</p>
        {day.exercises.length ? (
          <ol className="grid gap-2">
            {day.exercises.map((ex, i) => {
              const timed = ex.reps.endsWith(" s");
              return (
                <li key={ex.name} className="rounded-2xl bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        <span className="tabular mr-1.5 text-muted">{i + 1}.</span>
                        {ex.name}
                        {ex.focus ? <Star className="ml-1 inline size-3.5 fill-primary text-primary" aria-label="Zona prioritaria" /> : null}
                      </p>
                      <p className="text-xs text-muted first-letter:uppercase">{ex.muscles}</p>
                    </div>
                    <p className="tabular shrink-0 rounded-xl bg-surface px-2.5 py-1 text-sm font-black">
                      {ex.sets}×{ex.reps}
                    </p>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    Descanso {formatRest(ex.restSec)}
                    {timed ? "" : ` · RIR ${ex.rir}`}
                  </p>
                  {ex.cue || ex.note ? <p className="mt-1 text-xs">✅ {[ex.cue, ex.note].filter(Boolean).join(" ")}</p> : null}
                  {ex.alternatives.length ? (
                    <p className="mt-1 flex items-start gap-1 text-xs text-muted">
                      <Repeat2 className="mt-px size-3.5 shrink-0" aria-hidden="true" /> También vale: {ex.alternatives.join(" · ")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
        {day.cardio ? (
          <p className="flex items-start gap-2 rounded-2xl border border-border p-3 text-sm">
            <Flame className="mt-0.5 size-4 shrink-0 text-ember" aria-hidden="true" /> {day.cardio}
          </p>
        ) : null}
      </div>
    </details>
  );
}
