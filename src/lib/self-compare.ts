import { addDays, diffDays, startOfIsoWeek, startOfMonth, type IsoDate } from "./dates";
import { summarize, type DayStat } from "./stats";

export type PeriodNumbers = {
  percent: number | null;
  activeDays: number;
  perfectDays: number;
  workouts: number;
  minutes: number;
};

export type SelfComparison = { label: string; previousLabel: string; now: PeriodNumbers; before: PeriodNumbers };

function numbers(series: DayStat[], workouts: { date: IsoDate; minutes: number }[], from: IsoDate, to: IsoDate): PeriodNumbers {
  const t = summarize(series, from, to);
  const perfectDays = series.filter((s) => s.day >= from && s.day <= to && s.required > 0 && s.completed >= s.required).length;
  const inRange = workouts.filter((w) => w.date >= from && w.date <= to);
  return { percent: t.percent, activeDays: t.activeDays, perfectDays, workouts: inRange.length, minutes: inRange.reduce((a, w) => a + w.minutes, 0) };
}

/**
 * Tú contra tu yo pasado: esta semana/mes frente al mismo tramo de la semana/mes
 * anterior (mismos días transcurridos, para que la comparación sea justa).
 */
export function compareWithPast(series: DayStat[], workouts: { date: IsoDate; minutes: number }[], today: IsoDate): SelfComparison[] {
  const weekStart = startOfIsoWeek(today);
  const weekElapsed = diffDays(today, weekStart);
  const prevWeekStart = addDays(weekStart, -7);

  const monthStart = startOfMonth(today);
  const monthElapsed = diffDays(today, monthStart);
  const prevMonthStart = startOfMonth(addDays(monthStart, -1));
  const prevMonthEnd = addDays(monthStart, -1);
  const prevMonthTo = addDays(prevMonthStart, monthElapsed) > prevMonthEnd ? prevMonthEnd : addDays(prevMonthStart, monthElapsed);

  return [
    {
      label: "Esta semana",
      previousLabel: "semana pasada",
      now: numbers(series, workouts, weekStart, today),
      before: numbers(series, workouts, prevWeekStart, addDays(prevWeekStart, weekElapsed)),
    },
    {
      label: "Este mes",
      previousLabel: "mes pasado",
      now: numbers(series, workouts, monthStart, today),
      before: numbers(series, workouts, prevMonthStart, prevMonthTo),
    },
  ];
}
