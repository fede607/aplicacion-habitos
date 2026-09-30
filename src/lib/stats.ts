/**
 * Cálculo puro de progreso, rachas y niveles. Sin dependencias de BD: se testea
 * de forma unitaria y se usa tanto en el panel personal como en el de grupo.
 *
 * Definiciones (documentadas también en el README):
 *  - Hábito "obligatorio" en un día: activo, no opcional, frecuencia diaria o
 *    programado para ese día de la semana, y con `starts_on` <= día.
 *  - "No aplica" (skipped) lo saca del denominador.
 *  - % del día = completados / obligatorios. Días sin obligatorios = descanso.
 *  - Día cumplido (verde) = % >= umbral del grupo (streak_threshold). Cuenta para la racha.
 *  - Los días de descanso no rompen ni suman racha. Hoy, si aún no está cumplido,
 *    tampoco rompe la racha (el día no ha terminado).
 *  - Hábitos con objetivo semanal se miden por semanas (x / objetivo).
 */
import { addDays, isoWeekday, startOfIsoWeek, type IsoDate } from "./dates";
import type { HabitFrequency, HabitLogStatus } from "./database.types";

export type DayStat = {
  day: IsoDate;
  required: number;
  completed: number;
  skipped: number;
  bonus: number;
};

export type ScheduleHabit = {
  frequency: HabitFrequency;
  weekdays: number[];
  weekly_target: number | null;
  is_optional: boolean;
  is_active: boolean;
  starts_on: IsoDate;
};

export type DayLevel =
  "complete" | "partial" | "low" | "rest" | "none" | "future";

/** ¿Está programado el hábito ese día? (independiente de si es obligatorio). */
export function isScheduledOn(habit: ScheduleHabit, day: IsoDate): boolean {
  if (!habit.is_active || day < habit.starts_on) return false;
  switch (habit.frequency) {
    case "daily":
      return true;
    case "weekdays":
      return habit.weekdays.includes(isoWeekday(day));
    case "weekly_target":
      return true; // disponible cualquier día de la semana
  }
}

/** ¿Cuenta en el % diario? */
export function isRequiredOn(habit: ScheduleHabit, day: IsoDate): boolean {
  return (
    !habit.is_optional &&
    habit.frequency !== "weekly_target" &&
    isScheduledOn(habit, day)
  );
}

export function dayPercent(
  stat: Pick<DayStat, "required" | "completed">,
): number | null {
  if (stat.required <= 0) return null;
  return Math.round(
    (Math.min(stat.completed, stat.required) / stat.required) * 100,
  );
}

export function isGoodDay(
  stat: Pick<DayStat, "required" | "completed">,
  threshold: number,
): boolean {
  return stat.required > 0 && stat.completed * 100 >= stat.required * threshold;
}

export function dayLevel(
  stat: DayStat | undefined,
  threshold: number,
  day: IsoDate,
  today: IsoDate,
): DayLevel {
  if (day > today) return "future";
  if (!stat) return "none";
  if (stat.required === 0) return stat.bonus > 0 ? "rest" : "none";
  const pct = dayPercent(stat) ?? 0;
  if (isGoodDay(stat, threshold)) return "complete";
  if (
    stat.completed === 0 &&
    stat.skipped === 0 &&
    day !== today &&
    stat.bonus === 0
  )
    return "none";
  return pct >= 40 ? "partial" : "low";
}

export type Streaks = { current: number; best: number };

/** Rachas de días cumplidos a partir de una serie diaria (cualquier orden). */
export function computeStreaks(
  stats: DayStat[],
  threshold: number,
  today: IsoDate,
): Streaks {
  const sorted = [...stats]
    .filter((s) => s.day <= today)
    .sort((a, b) => (a.day < b.day ? -1 : 1));
  let run = 0;
  let best = 0;
  let prevDay: IsoDate | null = null;
  for (const s of sorted) {
    // Un hueco en la serie (días sin fila) cuenta como día no cumplido.
    if (prevDay && addDays(prevDay, 1) !== s.day) run = 0;
    prevDay = s.day;
    if (s.required === 0) continue;
    if (isGoodDay(s, threshold)) {
      run += 1;
      best = Math.max(best, run);
    } else if (s.day !== today) {
      run = 0;
    }
  }
  if (prevDay && prevDay < addDays(today, -1)) run = 0;
  return { current: run, best };
}

export type Totals = {
  required: number;
  completed: number;
  percent: number | null;
  activeDays: number;
};

export function summarize(
  stats: DayStat[],
  from: IsoDate,
  to: IsoDate,
): Totals {
  let required = 0;
  let completed = 0;
  let activeDays = 0;
  for (const s of stats) {
    if (s.day < from || s.day > to) continue;
    required += s.required;
    completed += Math.min(s.completed, s.required);
    if (s.completed + s.bonus > 0) activeDays += 1;
  }
  return {
    required,
    completed,
    percent: required > 0 ? Math.round((completed / required) * 100) : null,
    activeDays,
  };
}

export type HabitStreak = { value: number; unit: "days" | "weeks" };

/**
 * Racha individual de un hábito.
 *  - Diarios / por días: ocurrencias programadas consecutivas hechas. "No aplica"
 *    es neutro; hoy pendiente es neutro.
 *  - Objetivo semanal: semanas consecutivas alcanzando el objetivo (la semana en
 *    curso sólo suma si ya se alcanzó).
 */
export function habitStreak(
  habit: ScheduleHabit,
  logs: Map<IsoDate, HabitLogStatus>,
  today: IsoDate,
  maxLookbackDays = 400,
): HabitStreak {
  if (habit.frequency === "weekly_target") {
    const target = habit.weekly_target ?? 1;
    let weeks = 0;
    let weekStart = startOfIsoWeek(today);
    for (let i = 0; i < Math.ceil(maxLookbackDays / 7); i++) {
      if (addDays(weekStart, 6) < habit.starts_on) break;
      let done = 0;
      for (let d = 0; d < 7; d++)
        if (logs.get(addDays(weekStart, d)) === "done") done += 1;
      const isCurrent = weekStart === startOfIsoWeek(today);
      if (done >= target) weeks += 1;
      else if (!isCurrent) break;
      weekStart = addDays(weekStart, -7);
    }
    return { value: weeks, unit: "weeks" };
  }

  let count = 0;
  for (let i = 0; i < maxLookbackDays; i++) {
    const day = addDays(today, -i);
    if (day < habit.starts_on) break;
    if (!isScheduledOn(habit, day)) continue;
    const status = logs.get(day);
    if (status === "done") count += 1;
    else if (status === "skipped" || (day === today && status === undefined))
      continue;
    else break;
  }
  return { value: count, unit: "days" };
}

export function weeklyTargetProgress(
  logs: Map<IsoDate, HabitLogStatus>,
  weekStart: IsoDate,
  target: number,
): { done: number; target: number; percent: number } {
  let done = 0;
  for (let d = 0; d < 7; d++)
    if (logs.get(addDays(weekStart, d)) === "done") done += 1;
  return {
    done,
    target,
    percent: Math.min(100, Math.round((done / target) * 100)),
  };
}

// -----------------------------------------------------------------------------
// XP y niveles (gamificación ligera)
// -----------------------------------------------------------------------------
export const XP_RULES = { habitDone: 10, workout: 20, noteDay: 5 } as const;

export function computeXp(input: {
  habitsDone: number;
  workouts: number;
  noteDays: number;
  achievementXp: number;
}): number {
  return (
    input.habitsDone * XP_RULES.habitDone +
    input.workouts * XP_RULES.workout +
    input.noteDays * XP_RULES.noteDay +
    input.achievementXp
  );
}

/** XP total necesario para alcanzar un nivel: 0, 100, 300, 600, 1000… */
export function xpForLevel(level: number): number {
  return (100 * (level - 1) * level) / 2;
}

export function levelFromXp(xp: number): {
  level: number;
  current: number;
  next: number;
  progress: number;
} {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    current,
    next,
    progress: Math.round(((xp - current) / (next - current)) * 100),
  };
}
