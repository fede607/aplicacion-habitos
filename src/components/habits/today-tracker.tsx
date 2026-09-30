"use client";

import {
  Check,
  CircleCheck,
  CloudOff,
  LoaderCircle,
  Minus,
  X,
} from "lucide-react";
import type { HabitLogStatus, HabitRow } from "@/lib/database.types";
import { describeFrequency } from "@/lib/labels";
import { isRequiredOn } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/ui/progress";
import { HabitIcon } from "./habit-icon";
import { useHabitSync, type SaveState } from "./use-habit-sync";

type Status = HabitLogStatus | null;

export type TrackerHabit = Pick<
  HabitRow,
  | "id"
  | "name"
  | "description"
  | "icon"
  | "color"
  | "frequency"
  | "weekdays"
  | "weekly_target"
  | "is_optional"
  | "is_active"
  | "starts_on"
  | "goal"
> & { weekDone: number };

export function TodayTracker({
  date,
  habits,
  initialStatuses,
  editable,
}: {
  date: string;
  habits: TrackerHabit[];
  initialStatuses: Record<string, Status>;
  editable: boolean;
}) {
  const { statuses, saveStates, update, pendingCount } = useHabitSync(
    date,
    initialStatuses,
  );

  const required = habits.filter((h) => isRequiredOn(h, date));
  const weekly = habits.filter((h) => h.frequency === "weekly_target");
  const others = habits.filter(
    (h) => !required.includes(h) && !weekly.includes(h),
  );

  const counted = required.filter((h) => statuses[h.id] !== "skipped");
  const done = counted.filter((h) => statuses[h.id] === "done").length;
  const percent = counted.length
    ? Math.round((done / counted.length) * 100)
    : 0;
  const anySaving = Object.values(saveStates).some(
    (s) => s === "saving" || s === "retrying",
  );

  const cardProps = (h: TrackerHabit) => ({
    habit: h,
    date,
    status: statuses[h.id] ?? null,
    saveState: saveStates[h.id] ?? "idle",
    editable,
    onChange: (s: Status) => update(h.id, s),
  });

  return (
    <div className="grid gap-6">
      <section
        aria-labelledby="progress-title"
        className="aurora relative overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6"
      >
        <div className="flex items-center gap-5 sm:gap-8">
          <ProgressRing value={percent} label={`Progreso de hoy: ${percent}%`}>
            <div className="text-center">
              <div className="tabular text-3xl font-bold tracking-tight">
                {percent}%
              </div>
              <div className="text-xs text-muted">hoy</div>
            </div>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <h2 id="progress-title" className="text-sm font-medium text-muted">
              Progreso
            </h2>
            <p className="tabular mt-1 text-3xl font-bold tracking-tight">
              {done} <span className="text-muted">/ {counted.length}</span>
            </p>
            <p className="text-sm text-muted">hábitos del día</p>
            <SyncStatus pending={pendingCount} saving={anySaving} />
          </div>
        </div>
      </section>

      {!editable ? (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
          Este día ya no es editable (sólo se pueden modificar los últimos 7
          días).
        </p>
      ) : null}

      {required.length > 0 ? (
        <HabitSection title="Hoy toca" count={`${done}/${counted.length}`}>
          {required.map((h) => (
            <HabitCard key={h.id} {...cardProps(h)} />
          ))}
        </HabitSection>
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          Hoy no hay hábitos obligatorios. ¡Día de descanso! Puedes sumar puntos
          con los objetivos semanales.
        </p>
      )}

      {weekly.length > 0 ? (
        <HabitSection title="Objetivos semanales">
          {weekly.map((h) => (
            <HabitCard key={h.id} {...cardProps(h)} />
          ))}
        </HabitSection>
      ) : null}

      {others.length > 0 ? (
        <HabitSection
          title="Opcionales y otros días"
          subtitle="No cuentan para el % de hoy, pero suman XP."
        >
          {others.map((h) => (
            <HabitCard key={h.id} {...cardProps(h)} />
          ))}
        </HabitSection>
      ) : null}
    </div>
  );
}

function SyncStatus({ pending, saving }: { pending: number; saving: boolean }) {
  if (saving || pending > 0) {
    return (
      <p
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted"
        role="status"
        aria-live="polite"
      >
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        Guardando{pending > 1 ? ` ${pending} cambios` : ""}…
      </p>
    );
  }
  return (
    <p
      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-success"
      role="status"
      aria-live="polite"
    >
      <CircleCheck className="size-3.5" aria-hidden="true" />
      Todo guardado
    </p>
  );
}

function HabitSection({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-end justify-between px-1">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
        </div>
        {count ? (
          <span className="tabular text-sm font-semibold text-muted">
            {count}
          </span>
        ) : null}
      </div>
      <ul className="grid gap-2.5 md:grid-cols-2">{children}</ul>
    </section>
  );
}

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  saving: "Guardando…",
  saved: "Guardado ✓",
  retrying: "Sin conexión, reintentando…",
  error: "No se pudo guardar",
};

function HabitCard({
  habit,
  status,
  saveState,
  editable,
  onChange,
}: {
  habit: TrackerHabit;
  date: string;
  status: Status;
  saveState: SaveState;
  editable: boolean;
  onChange: (status: Status) => void;
}) {
  const done = status === "done";
  const weeklyDone =
    habit.frequency === "weekly_target"
      ? habit.weekDone + (done ? 1 : 0)
      : null;

  return (
    <li
      className={cn(
        "group relative flex gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-card transition-colors",
        done && "border-success/40 bg-success-soft/40",
        status === "skipped" && "opacity-70",
      )}
    >
      <span
        className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: `${habit.color}22`, color: habit.color }}
      >
        <HabitIcon name={habit.icon} className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-semibold leading-tight break-words",
            done && "text-success",
          )}
        >
          {habit.name}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {[habit.goal, describeFrequency(habit)].filter(Boolean).join(" · ")}
          {weeklyDone !== null ? (
            <span className="tabular ml-1 font-semibold text-foreground">
              · {weeklyDone}/{habit.weekly_target} esta semana
            </span>
          ) : null}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <StatusChip
            label="No hecho"
            icon={<X />}
            active={status === "missed"}
            disabled={!editable}
            tone="danger"
            onClick={() => onChange(status === "missed" ? null : "missed")}
          />
          <StatusChip
            label="No aplica"
            icon={<Minus />}
            active={status === "skipped"}
            disabled={!editable}
            tone="neutral"
            onClick={() => onChange(status === "skipped" ? null : "skipped")}
          />
          <span
            className={cn(
              "ml-auto text-[11px] font-medium",
              saveState === "saved" && "text-success",
              saveState === "error" && "text-danger",
              saveState === "retrying" && "text-warning",
              (saveState === "saving" || saveState === "idle") && "text-muted",
            )}
            aria-live="polite"
          >
            {saveState === "retrying" ? (
              <CloudOff className="mr-1 inline size-3" aria-hidden="true" />
            ) : null}
            {SAVE_LABEL[saveState]}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange(done ? null : "done")}
        disabled={!editable}
        aria-pressed={done}
        aria-label={
          done
            ? `Desmarcar ${habit.name}`
            : `Marcar ${habit.name} como completado`
        }
        className={cn(
          "grid size-12 shrink-0 place-items-center self-center rounded-2xl border-2 transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-50",
          done
            ? "border-success bg-success text-white dark:text-background"
            : "border-border bg-surface-2 text-transparent hover:border-primary hover:text-primary/40",
        )}
      >
        <Check className="size-6" strokeWidth={3} aria-hidden="true" />
      </button>
    </li>
  );
}

function StatusChip({
  label,
  icon,
  active,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  disabled: boolean;
  tone: "danger" | "neutral";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full border border-border px-2.5 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50 [&_svg]:size-3.5",
        active &&
          tone === "danger" &&
          "border-danger/40 bg-danger-soft text-danger hover:text-danger",
        active &&
          tone === "neutral" &&
          "border-foreground/20 bg-surface-2 text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
