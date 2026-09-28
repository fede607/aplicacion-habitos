/**
 * Utilidades de fechas basadas en "días de calendario" ISO (YYYY-MM-DD).
 *
 * Regla clave: un día de registro es SIEMPRE el día local del usuario según la
 * zona horaria de su perfil. Nunca se deriva de `new Date()` sin zona, así se evita
 * el clásico "marqué el lunes y aparece el domingo".
 * La aritmética se hace en UTC puro sobre fechas sin hora, que no sufre DST.
 */

export type IsoDate = string;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Día de calendario actual en la zona horaria dada. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Hora local "HH:MM" en la zona horaria dada. */
export function timeInTimeZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

function toUtc(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtc(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(a).getTime() - toUtc(b).getTime()) / 86_400_000);
}

/** Día ISO de la semana: 1 = lunes … 7 = domingo. */
export function isoWeekday(date: IsoDate): number {
  const day = toUtc(date).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Lunes de la semana ISO que contiene `date`. */
export function startOfIsoWeek(date: IsoDate): IsoDate {
  return addDays(date, 1 - isoWeekday(date));
}

export function startOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: IsoDate): IsoDate {
  const d = toUtc(startOfMonth(date));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return fromUtc(d);
}

export function addMonths(month: string, delta: number): string {
  const d = toUtc(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return fromUtc(d).slice(0, 7);
}

export function isMonthString(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Celdas de un calendario mensual (semanas empezando en lunes, con huecos null). */
export function monthGrid(month: string): (IsoDate | null)[][] {
  const first = `${month}-01`;
  const last = endOfMonth(first);
  const cells: (IsoDate | null)[] = Array.from({ length: isoWeekday(first) - 1 }, () => null);
  for (const d of eachDay(first, last)) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (IsoDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const LOCALE = "es-ES";

export function formatLongDate(date: IsoDate): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(toUtc(date));
}

export function formatShortDate(date: IsoDate): string {
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" }).format(toUtc(date));
}

export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    toUtc(`${month}-01`),
  );
}

export function formatWeekdayShort(date: IsoDate): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "short", timeZone: "UTC" }).format(toUtc(date));
}

export const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const;
export const WEEKDAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
