import { addDays, type IsoDate } from "./dates";
import type { DayStat } from "./stats";

/**
 * «Tu año en una línea»: tu constancia diaria (media de 7 días, 0-100 %) desde
 * el primer día que registraste este año hasta hoy. Puro y testeable; lo usan
 * la pantalla y la imagen para compartir.
 */
export type LinePoint = { date: IsoDate; value: number | null };
export type YearLine = {
  year: number;
  points: LinePoint[];
  /** Media de los últimos 7 días (null si aún no hay datos). */
  current: number | null;
  /** Cambio frente a hace 30 días, en puntos (null si no hay con qué comparar). */
  delta30: number | null;
  best: { date: IsoDate; value: number } | null;
  perfectDays: number;
};

export const WINDOW = 7;

export function buildYearLine(series: DayStat[], year: number, today: IsoDate): YearLine {
  const byDay = new Map(series.map((s) => [s.day, s]));
  const start = `${year}-01-01` as IsoDate;
  const firstTracked = series
    .filter((s) => s.day >= start && s.day <= today && s.required > 0)
    .map((s) => s.day)
    .sort()[0];
  const empty: YearLine = { year, points: [], current: null, delta30: null, best: null, perfectDays: 0 };
  if (!firstTracked) return empty;

  const points: LinePoint[] = [];
  const window: { required: number; completed: number }[] = [];
  let perfectDays = 0;
  for (let d = firstTracked as IsoDate; d <= today; d = addDays(d, 1)) {
    const s = byDay.get(d);
    const required = s && s.required > 0 ? s.required : 0;
    const completed = s ? Math.min(s.completed, required) : 0;
    if (required > 0 && completed >= required) perfectDays++;
    window.push({ required, completed });
    if (window.length > WINDOW) window.shift();
    const req = window.reduce((a, w) => a + w.required, 0);
    const done = window.reduce((a, w) => a + w.completed, 0);
    points.push({ date: d, value: req > 0 ? Math.round((done / req) * 100) : null });
  }

  const valued = points.filter((p): p is { date: IsoDate; value: number } => p.value !== null);
  const current = valued.at(-1)?.value ?? null;
  const past = points.find((p) => p.date === addDays(today, -30))?.value ?? null;
  const best = valued.reduce<{ date: IsoDate; value: number } | null>((b, p) => (!b || p.value >= b.value ? p : b), null);
  return { year, points, current, delta30: current !== null && past !== null ? current - past : null, best, perfectDays };
}

/** Ruta SVG de la línea (los huecos sin datos cortan la línea). */
export function linePath(points: LinePoint[], width: number, height: number): string {
  if (!points.length) return "";
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  let d = "";
  let pen = false;
  points.forEach((p, i) => {
    if (p.value === null) {
      pen = false;
      return;
    }
    const x = (i * step).toFixed(1);
    const y = (height - (p.value / 100) * height).toFixed(1);
    d += `${pen ? "L" : "M"}${x} ${y} `;
    pen = true;
  });
  return d.trim();
}
