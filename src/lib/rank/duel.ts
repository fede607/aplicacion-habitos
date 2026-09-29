/**
 * Duelos semanales: gana quien tenga mejor % diario ponderado (el mismo que usa
 * el Rank Engine) de media en la semana. Los días de descanso no cuentan.
 */
import { addDays, type IsoDate } from "../dates";
import type { RankHistoryPoint } from "./engine";

export type DuelSide = { average: number | null; scoredDays: number; completeDays: number };

export type DuelOutcome = "a" | "b" | "draw" | "pending";

/** Margen mínimo para ganar: por debajo, desempata por días cumplidos o es empate. */
export const DUEL_MARGIN = 0.5;

export function duelSide(history: RankHistoryPoint[], weekStart: IsoDate, today: IsoDate, threshold: number): DuelSide {
  const end = addDays(weekStart, 6) < today ? addDays(weekStart, 6) : today;
  const scores = history
    .filter((p) => p.date >= weekStart && p.date <= end && p.dailyScore !== null)
    .map((p) => p.dailyScore!);
  if (!scores.length) return { average: null, scoredDays: 0, completeDays: 0 };
  const average = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  return { average, scoredDays: scores.length, completeDays: scores.filter((s) => s >= threshold).length };
}

export function isDuelFinished(weekStart: IsoDate, today: IsoDate): boolean {
  return today > addDays(weekStart, 6);
}

/** Quién va ganando (o ha ganado si la semana terminó). */
export function duelLeader(a: DuelSide, b: DuelSide): Exclude<DuelOutcome, "pending"> {
  const av = a.average ?? 0;
  const bv = b.average ?? 0;
  if (Math.abs(av - bv) >= DUEL_MARGIN) return av > bv ? "a" : "b";
  if (a.completeDays !== b.completeDays) return a.completeDays > b.completeDays ? "a" : "b";
  return "draw";
}
