import {
  addDays,
  addMonths,
  endOfMonth,
  isoWeekday,
  startOfMonth,
  type IsoDate,
} from "./dates";
import {
  isRequiredOn,
  summarize,
  type DayStat,
  type ScheduleHabit,
  type Totals,
} from "./stats";

/**
 * Analíticas avanzadas (Pro). Funciones puras sobre las series diarias y los
 * registros del usuario, para poder testearlas sin BD.
 */

export type Period = { from: IsoDate; to: IsoDate };

/** Mes en curso hasta hoy y el mismo tramo de días del mes anterior (comparación justa). */
export function monthToDatePeriods(today: IsoDate): {
  current: Period;
  previous: Period;
} {
  const current = { from: startOfMonth(today), to: today };
  const prevFrom = `${addMonths(today.slice(0, 7), -1)}-01`;
  const dayIndex = Number(today.slice(8, 10)) - 1;
  const prevEndOfMonth = endOfMonth(prevFrom);
  const candidate = addDays(prevFrom, dayIndex);
  return {
    current,
    previous: {
      from: prevFrom,
      to: candidate > prevEndOfMonth ? prevEndOfMonth : candidate,
    },
  };
}

export type MonthComparison = {
  current: Totals;
  previous: Totals;
  deltaPoints: number | null;
};

export function compareMonths(
  series: DayStat[],
  today: IsoDate,
): MonthComparison {
  const { current, previous } = monthToDatePeriods(today);
  const c = summarize(series, current.from, current.to);
  const p = summarize(series, previous.from, previous.to);
  return {
    current: c,
    previous: p,
    deltaPoints:
      c.percent !== null && p.percent !== null ? c.percent - p.percent : null,
  };
}

export type WeekdayPattern = {
  weekday: number;
  required: number;
  completed: number;
  percent: number | null;
};

/** % de cumplimiento por día de la semana (1 = lunes). */
export function weekdayPattern(
  series: DayStat[],
  from: IsoDate,
  to: IsoDate,
): WeekdayPattern[] {
  const acc = Array.from({ length: 7 }, (_, i) => ({
    weekday: i + 1,
    required: 0,
    completed: 0,
  }));
  for (const s of series) {
    if (s.day < from || s.day > to || s.required <= 0) continue;
    const slot = acc[isoWeekday(s.day) - 1];
    slot.required += s.required;
    slot.completed += Math.min(s.completed, s.required);
  }
  return acc.map((a) => ({
    ...a,
    percent:
      a.required > 0 ? Math.round((a.completed / a.required) * 100) : null,
  }));
}

export type HabitTrend = {
  habitId: string;
  name: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
};

type HabitForTrend = ScheduleHabit & { id: string; name: string };

function habitRate(
  habit: HabitForTrend,
  logs: Map<IsoDate, string> | undefined,
  period: Period,
): number | null {
  let required = 0;
  let done = 0;
  for (let d = period.from; d <= period.to; d = addDays(d, 1)) {
    if (!isRequiredOn(habit, d)) continue;
    required++;
    if (logs?.get(d) === "done") done++;
  }
  return required > 0 ? Math.round((done / required) * 100) : null;
}

/** Cumplimiento de cada hábito obligatorio este mes frente al mismo tramo del anterior. */
export function habitTrends(
  habits: HabitForTrend[],
  logIndex: Map<string, Map<IsoDate, string>>,
  today: IsoDate,
): HabitTrend[] {
  const { current, previous } = monthToDatePeriods(today);
  return habits
    .filter((h) => !h.is_optional && h.frequency !== "weekly_target")
    .map((h) => {
      const c = habitRate(h, logIndex.get(h.id), current);
      const p = habitRate(h, logIndex.get(h.id), previous);
      return {
        habitId: h.id,
        name: h.name,
        current: c,
        previous: p,
        delta: c !== null && p !== null ? c - p : null,
      };
    })
    .sort((a, b) => (a.current ?? -1) - (b.current ?? -1));
}

/** Escapa un valor para CSV (RFC 4180) y neutraliza fórmulas de Excel. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return (
    [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n"
  );
}
