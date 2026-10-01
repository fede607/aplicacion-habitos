import { addDays, endOfMonth, type IsoDate } from "./dates";
import type { DayStat } from "./stats";

/**
 * «Tu año en píxeles»: cada día del año es un cuadrado que se pinta según cuánto
 * cumpliste. Puro y testeable; lo usan la pantalla y la imagen para compartir.
 */
export type PixelLevel = "future" | "none" | "rest" | 0 | 1 | 2 | 3 | 4;
export type Pixel = { date: IsoDate; level: PixelLevel; percent: number | null };
export type YearPixels = { year: number; months: Pixel[][]; perfectDays: number; trackedDays: number; bestMonth: number | null };

export const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** 0 = nada, 1 = <50 %, 2 = <80 %, 3 = <100 %, 4 = día perfecto. */
export function levelFor(percent: number): 0 | 1 | 2 | 3 | 4 {
  if (percent >= 100) return 4;
  if (percent >= 80) return 3;
  if (percent >= 50) return 2;
  if (percent > 0) return 1;
  return 0;
}

export function buildYearPixels(series: DayStat[], year: number, today: IsoDate): YearPixels {
  const byDay = new Map(series.map((s) => [s.day, s]));
  const months: Pixel[][] = [];
  let perfectDays = 0;
  let trackedDays = 0;
  const monthScore: { sum: number; n: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const first = `${year}-${String(m).padStart(2, "0")}-01` as IsoDate;
    const last = endOfMonth(first);
    const days: Pixel[] = [];
    const score = { sum: 0, n: 0 };
    for (let d = first; d <= last; d = addDays(d, 1)) {
      if (d > today) {
        days.push({ date: d, level: "future", percent: null });
        continue;
      }
      const s = byDay.get(d);
      if (!s) {
        days.push({ date: d, level: "none", percent: null });
        continue;
      }
      if (s.required <= 0) {
        days.push({ date: d, level: s.bonus > 0 ? 2 : "rest", percent: null });
        continue;
      }
      const percent = Math.round((Math.min(s.completed, s.required) / s.required) * 100);
      const level = levelFor(percent);
      if (level === 4) perfectDays++;
      trackedDays++;
      score.sum += percent;
      score.n++;
      days.push({ date: d, level, percent });
    }
    months.push(days);
    monthScore.push(score);
  }
  let bestMonth: number | null = null;
  let best = -1;
  monthScore.forEach((s, i) => {
    if (s.n >= 5 && s.sum / s.n > best) {
      best = s.sum / s.n;
      bestMonth = i;
    }
  });
  return { year, months, perfectDays, trackedDays, bestMonth };
}

/** Colores de cada nivel (sirven en claro y oscuro y en la imagen). */
export const PIXEL_COLORS: Record<string, string> = {
  future: "rgba(148,163,184,0.12)",
  none: "rgba(148,163,184,0.22)",
  rest: "rgba(148,163,184,0.38)",
  "0": "#7f1d1d",
  "1": "#c2410c",
  "2": "#f59e0b",
  "3": "#84cc16",
  "4": "#22c55e",
};
