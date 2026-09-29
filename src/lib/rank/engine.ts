/**
 * Rank Engine de Winter Arc: ÚNICA fuente de verdad del score de disciplina y
 * del rango. Puro y determinista (sin BD, sin reloj): mismas entradas → mismo
 * resultado, así el histórico siempre se puede reconstruir desde los registros.
 *
 *   registros + versiones de hábitos → puntuación diaria ponderada
 *   → componentes → score de disciplina (con confianza y suavizado) → rango
 */
import { addDays, diffDays, isIsoDate, isoWeekday, startOfIsoWeek, type IsoDate } from "../dates";
import type { HabitCategory, HabitFrequency, HabitLogStatus } from "../database.types";
import { getTier, LEGEND_INDEX, MAX_TIER_BELOW_LEGEND, nextTier, progressInTier, tierIndexForScore } from "./tiers";

export const RANK_ALGORITHM_VERSION = 1;

/** Pesos reales del score de disciplina (suman 1). La UI los muestra tal cual. */
export const RANK_WEIGHTS = {
  consistency: 0.3,
  completion: 0.25,
  difficulty: 0.15,
  recent: 0.15,
  streak: 0.1,
  progress: 0.05,
} as const;

export type RankComponent = keyof typeof RANK_WEIGHTS;

export const RANK_CONFIG = {
  habitWeights: [1, 1.5, 2] as const,
  hardWeight: 1.5,
  completionSpan: 14,
  consistencyWindow: 28,
  recentWindow: 7,
  progressMinDays: 14,
  streakScale: 10,
  partialMin: 50,
  partialCredit: 0.35,
  skipAllowance: 0.15,
  skipWindow: 7,
  lateLogFactor: 0.85,
  lateAfterDays: 1,
  demandFullLoad: 4,
  demandMinFactor: 0.8,
  prior: 30,
  fullConfidenceDays: 30,
  maxDailyRise: 2,
  maxDailyDrop: 1.5,
  peakFloorRatio: 0.65,
  legendMinDays: 42,
  legendMinConsistency: 90,
  maxRangeDays: 400,
} as const;

export type RankPhase = "none" | "provisional" | "estimated" | "stabilizing" | "stable";

export const PHASE_LABELS: Record<RankPhase, string> = {
  none: "Sin datos",
  provisional: "Provisional",
  estimated: "Estimado",
  stabilizing: "Estabilizándose",
  stable: "Estable",
};

export type RankHabitRevision = {
  habitId: string;
  effectiveFrom: IsoDate;
  weight: number;
  category: HabitCategory;
  frequency: HabitFrequency;
  weekdays: number[];
  weeklyTarget: number | null;
  isOptional: boolean;
  isActive: boolean;
  archived: boolean;
  startsOn: IsoDate;
};

export type RankLog = {
  habitId: string;
  date: IsoDate;
  status: HabitLogStatus;
  /** Día local en que se registró/modificó por última vez (para detectar registros tardíos). */
  recordedOn: IsoDate | null;
};

export type RankInput = {
  from: IsoDate;
  today: IsoDate;
  threshold: number;
  revisions: RankHabitRevision[];
  logs: RankLog[];
};

export type RankComponents = Record<RankComponent, number>;

export type RankHistoryPoint = {
  date: IsoDate;
  dailyScore: number | null;
  score: number | null;
  tierIndex: number | null;
  scoredDays: number;
  currentStreak: number;
  bestStreak: number;
  consistency: number | null;
  components: RankComponents | null;
};

export type ScopeRank = {
  score: number | null;
  tierIndex: number | null;
  phase: RankPhase;
  scoredDays: number;
  components: RankComponents | null;
  demandFactor: number;
  progress: number;
  next: { index: number; name: string; min: number; pointsNeeded: number } | null;
  currentStreak: number;
  bestStreak: number;
  completeDays: number;
  partialDays: number;
  failedDays: number;
  restDays: number;
  /** % de días cumplidos entre los últimos 30 días puntuados. */
  consistency: number | null;
  peakScore: number | null;
  peakTierIndex: number | null;
  history: RankHistoryPoint[];
};

export type DayDetail = {
  date: IsoDate;
  required: number;
  done: number;
  dailyScore: number | null;
  weights: Record<string, number>;
  completed: string[];
};

export type RankResult = {
  version: number;
  from: IsoDate;
  to: IsoDate;
  threshold: number;
  global: ScopeRank;
  categories: Partial<Record<HabitCategory, ScopeRank>>;
  habits: Record<string, ScopeRank>;
  days: DayDetail[];
};

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const STATUSES: ReadonlySet<string> = new Set(["done", "missed", "skipped"]);

/** Peso saneado: 1 / 1,5 / 2. Cualquier otro valor (NaN, 50, -3) se ajusta. */
export function normalizeWeight(w: unknown): number {
  const n = typeof w === "number" ? w : Number(w);
  if (!Number.isFinite(n)) return 1;
  return clamp(Math.round(n * 2) / 2, 1, 2);
}

export function phaseFor(scoredDays: number): RankPhase {
  if (scoredDays <= 0) return "none";
  if (scoredDays <= 3) return "provisional";
  if (scoredDays <= 7) return "estimated";
  if (scoredDays < RANK_CONFIG.fullConfidenceDays) return "stabilizing";
  return "stable";
}

/** Día local (YYYY-MM-DD) de un timestamp en una zona horaria. Null si no es válido. */
export function localDateOf(timestamp: string | null | undefined, timeZone: string): IsoDate | null {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const out = `${get("year")}-${get("month")}-${get("day")}`;
    return isIsoDate(out) ? out : null;
  } catch {
    return null;
  }
}

function roundComponents(c: RankComponents | null): RankComponents | null {
  return c ? (Object.fromEntries(Object.entries(c).map(([k, v]) => [k, round2(v)])) as RankComponents) : null;
}

function consistency30(scored: number[], threshold: number): number | null {
  const last = scored.slice(-30);
  return last.length ? Math.round((last.filter((x) => x >= threshold).length / last.length) * 100) : null;
}

function emptyScope(): ScopeRank {
  return {
    score: null,
    tierIndex: null,
    phase: "none",
    scoredDays: 0,
    components: null,
    demandFactor: 1,
    progress: 0,
    next: null,
    currentStreak: 0,
    bestStreak: 0,
    completeDays: 0,
    partialDays: 0,
    failedDays: 0,
    restDays: 0,
    consistency: null,
    peakScore: null,
    peakTierIndex: null,
    history: [],
  };
}

// -----------------------------------------------------------------------------
// Saneado de entradas
// -----------------------------------------------------------------------------
type Cfg = Omit<RankHabitRevision, "habitId">;

function sanitizeRevisions(revs: RankHabitRevision[]): Map<string, Cfg[]> {
  const byHabit = new Map<string, Map<IsoDate, Cfg>>();
  for (const r of revs) {
    if (!r || typeof r.habitId !== "string" || !isIsoDate(r.effectiveFrom) || !isIsoDate(r.startsOn)) continue;
    const cfg: Cfg = {
      effectiveFrom: r.effectiveFrom,
      weight: normalizeWeight(r.weight),
      category: r.category,
      frequency: r.frequency,
      weekdays: (r.weekdays ?? []).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7),
      weeklyTarget: r.weeklyTarget == null ? null : clamp(Math.round(r.weeklyTarget), 1, 7),
      isOptional: !!r.isOptional,
      isActive: !!r.isActive,
      archived: !!r.archived,
      startsOn: r.startsOn,
    };
    let m = byHabit.get(r.habitId);
    if (!m) byHabit.set(r.habitId, (m = new Map()));
    m.set(r.effectiveFrom, cfg); // misma fecha: gana la última versión
  }
  const out = new Map<string, Cfg[]>();
  for (const [id, m] of byHabit) out.set(id, [...m.values()].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1)));
  return out;
}

/** Configuración vigente de un hábito en un día (la última versión con effectiveFrom <= día). */
function configAt(revs: Cfg[], day: IsoDate): Cfg | null {
  let found: Cfg | null = null;
  for (const r of revs) {
    if (r.effectiveFrom <= day) found = r;
    else break;
  }
  return found;
}

function counts(cfg: Cfg | null, day: IsoDate): cfg is Cfg {
  return !!cfg && cfg.isActive && !cfg.archived && !cfg.isOptional && day >= cfg.startsOn;
}

function isDailyRequired(cfg: Cfg | null, day: IsoDate): cfg is Cfg {
  if (!counts(cfg, day)) return false;
  if (cfg.frequency === "daily") return true;
  return cfg.frequency === "weekdays" && cfg.weekdays.includes(isoWeekday(day));
}

function isWeeklyActive(cfg: Cfg | null, day: IsoDate): cfg is Cfg {
  return counts(cfg, day) && cfg.frequency === "weekly_target";
}

// -----------------------------------------------------------------------------
// Celdas diarias por hábito
// -----------------------------------------------------------------------------
type Cell = { req: number; done: number; skip: number; hard: boolean; weight: number; completed: boolean };

function buildCells(days: IsoDate[], today: IsoDate, revs: Cfg[], logs: Map<IsoDate, RankLog>): (Cell | null)[] {
  const cells: (Cell | null)[] = days.map(() => null);
  const late = (l: RankLog) =>
    l.recordedOn && isIsoDate(l.recordedOn) && diffDays(l.recordedOn, l.date) > RANK_CONFIG.lateAfterDays ? RANK_CONFIG.lateLogFactor : 1;

  // Hábitos diarios / por días de la semana.
  days.forEach((day, i) => {
    const cfg = configAt(revs, day);
    if (!isDailyRequired(cfg, day)) return;
    const log = logs.get(day);
    const w = cfg.weight;
    cells[i] = {
      req: w,
      done: log?.status === "done" ? w * late(log) : 0,
      skip: log?.status === "skipped" ? w : 0,
      hard: w >= RANK_CONFIG.hardWeight,
      weight: w,
      completed: log?.status === "done",
    };
  });

  // Objetivos semanales: el objetivo se reparte entre los días activos de la
  // semana (target/7 por día) y todos esos días reciben el mismo % de la semana.
  // En la semana en curso sólo se exige lo proporcional a los días transcurridos.
  const weeks = new Map<IsoDate, number[]>();
  days.forEach((day, i) => {
    if (!isWeeklyActive(configAt(revs, day), day)) return;
    const wk = startOfIsoWeek(day);
    const list = weeks.get(wk) ?? [];
    list.push(i);
    weeks.set(wk, list);
  });
  for (const idxs of weeks.values()) {
    let expected = 0;
    let done = 0;
    for (const i of idxs) {
      const cfg = configAt(revs, days[i])!;
      if (days[i] <= today) expected += (cfg.weeklyTarget ?? 1) / 7;
      const log = logs.get(days[i]);
      if (log?.status === "done") done += late(log);
    }
    const ratio = expected > 0 ? Math.min(1, done / expected) : 0;
    for (const i of idxs) {
      const cfg = configAt(revs, days[i])!;
      const req = (cfg.weight * (cfg.weeklyTarget ?? 1)) / 7;
      cells[i] = {
        req,
        done: req * ratio,
        skip: 0,
        hard: cfg.weight >= RANK_CONFIG.hardWeight,
        weight: cfg.weight,
        completed: logs.get(days[i])?.status === "done",
      };
    }
  }
  return cells;
}

type DayAgg = { sched: number; done: number; skip: number };

function aggregate(cellsByHabit: (Cell | null)[][], dayCount: number, hardOnly: boolean): DayAgg[] {
  const out: DayAgg[] = Array.from({ length: dayCount }, () => ({ sched: 0, done: 0, skip: 0 }));
  for (const cells of cellsByHabit) {
    for (let i = 0; i < dayCount; i++) {
      const c = cells[i];
      if (!c || (hardOnly && !c.hard)) continue;
      out[i].sched += c.req;
      out[i].done += c.done;
      out[i].skip += c.skip;
    }
  }
  return out;
}

/**
 * "No aplica" es neutro sólo hasta un cupo (15 % de lo programado en 7 días).
 * Lo que excede el cupo cuenta como no hecho: marcar todo como "no aplica" no
 * convierte un mal día en descanso.
 */
export function applySkipBudget(aggs: DayAgg[]): { required: number; done: number; score: number | null }[] {
  const W = RANK_CONFIG.skipWindow;
  const neutral: number[] = [];
  return aggs.map((a, i) => {
    let schedWindow = 0;
    let neutralPrev = 0;
    for (let j = Math.max(0, i - W + 1); j <= i; j++) schedWindow += aggs[j].sched;
    for (let j = Math.max(0, i - W + 1); j < i; j++) neutralPrev += neutral[j];
    const allowance = Math.max(0, RANK_CONFIG.skipAllowance * schedWindow - neutralPrev);
    const n = Math.min(a.skip, allowance);
    neutral[i] = n;
    const required = Math.max(0, a.sched - n);
    if (required <= 1e-9) return { required: 0, done: 0, score: null };
    const done = Math.min(a.done, required);
    return { required, done, score: clamp((done / required) * 100, 0, 100) };
  });
}

// -----------------------------------------------------------------------------
// Trayectoria: componentes → score suavizado → rango
// -----------------------------------------------------------------------------
function trajectory(
  days: IsoDate[],
  today: IsoDate,
  threshold: number,
  daily: { required: number; score: number | null }[],
  hard: { score: number | null }[],
): ScopeRank {
  const cfg = RANK_CONFIG;
  const alpha = 2 / (cfg.completionSpan + 1);
  const res = emptyScope();
  const scored: number[] = [];
  const loads: number[] = [];
  let emaQ: number | null = null;
  let emaD: number | null = null;
  let streak = 0;
  let best = 0;
  let value: number | null = null;
  let tierIdx: number | null = null;
  let peak: number | null = null;
  let peakTier: number | null = null;
  let components: RankComponents | null = null;
  let demandFactor = 1;

  const point = (day: IsoDate, i: number): RankHistoryPoint => ({
    date: day,
    dailyScore: daily[i].score === null ? null : round2(daily[i].score!),
    score: value,
    tierIndex: tierIdx,
    scoredDays: scored.length,
    currentStreak: streak,
    bestStreak: best,
    consistency: consistency30(scored, threshold),
    components: roundComponents(components),
  });

  days.forEach((day, i) => {
    let s = daily[i].score;
    // Hoy aún no ha terminado: sólo cuenta si mejora tu media (nunca penaliza).
    if (s !== null && day === today && emaQ !== null && s < emaQ) s = null;

    if (s === null) {
      if (daily[i].score === null && day !== today) res.restDays += 1;
      res.history.push(point(day, i));
      return;
    }

    scored.push(s);
    loads.push(daily[i].required);
    const h = hard[i].score ?? s;
    emaQ = emaQ === null ? s : emaQ + alpha * (s - emaQ);
    emaD = emaD === null ? h : emaD + alpha * (h - emaD);

    const good = s >= threshold;
    if (good) {
      streak += 1;
      best = Math.max(best, streak);
    } else if (day !== today) {
      streak = 0;
    }
    if (good) res.completeDays += 1;
    else if (s >= 40) res.partialDays += 1;
    else res.failedDays += 1;

    // Componentes (0–100).
    const win = scored.slice(-cfg.consistencyWindow);
    let wSum = 0;
    let cSum = 0;
    win.forEach((x, j) => {
      const w = j + 1; // los días recientes pesan más
      wSum += w;
      cSum += w * (x >= threshold ? 1 : x >= cfg.partialMin ? cfg.partialCredit : 0);
    });
    const consistency = (cSum / wSum) * 100;
    const recent = mean(scored.slice(-cfg.recentWindow));
    let progress = 50;
    if (scored.length >= cfg.progressMinDays) {
      const prev = mean(scored.slice(-21, -7));
      progress = clamp(50 + 2 * (recent - prev), 0, 100);
    }
    if (recent >= 90) progress = Math.max(progress, recent); // mantener la excelencia también es progresar
    components = {
      consistency,
      completion: emaQ,
      difficulty: emaD,
      recent,
      streak: 100 * (1 - Math.exp(-streak / cfg.streakScale)),
      progress,
    };
    let raw = 0;
    for (const k of Object.keys(RANK_WEIGHTS) as RankComponent[]) raw += RANK_WEIGHTS[k] * components[k];

    // Exigencia de la rutina: una rutina de 1 hábito fácil no llega arriba.
    const load = mean(loads.slice(-cfg.consistencyWindow));
    demandFactor = cfg.demandMinFactor + (1 - cfg.demandMinFactor) * Math.min(1, load / cfg.demandFullLoad);
    raw *= demandFactor;

    // Confianza: con pocos días el score se acerca al punto de partida.
    const confidence = Math.sqrt(Math.min(1, scored.length / cfg.fullConfidenceDays));
    const target = cfg.prior + (raw - cfg.prior) * confidence;

    // Suavizado: subidas y bajadas limitadas por día + suelo sobre tu mejor marca.
    let next: number = value === null ? target : clamp(target, value - cfg.maxDailyDrop, value + cfg.maxDailyRise);
    if (peak !== null) next = Math.max(next, peak * cfg.peakFloorRatio);
    next = round2(clamp(next, 0, 100));
    value = next;

    let t = tierIndexForScore(value);
    if (t === LEGEND_INDEX && !(scored.length >= cfg.legendMinDays && consistency >= cfg.legendMinConsistency)) {
      t = MAX_TIER_BELOW_LEGEND;
    }
    if (tierIdx !== null) t = clamp(t, tierIdx - 1, tierIdx + 1); // nunca más de una división por día
    tierIdx = t;

    if (peak === null || value > peak) peak = value;
    if (peakTier === null || t > peakTier) peakTier = t;
    res.history.push(point(day, i));
  });

  res.scoredDays = scored.length;
  res.phase = phaseFor(scored.length);
  res.currentStreak = streak;
  res.bestStreak = best;
  res.score = value;
  res.tierIndex = tierIdx;
  res.peakScore = peak;
  res.peakTierIndex = peakTier;
  res.demandFactor = round2(demandFactor);
  res.components = roundComponents(components);
  res.consistency = consistency30(scored, threshold);
  if (value !== null && tierIdx !== null) {
    res.progress = round2(progressInTier(value, tierIdx));
    const n = nextTier(tierIdx);
    res.next = n ? { index: n.index, name: n.name, min: n.min, pointsNeeded: round2(Math.max(0, n.min - value)) } : null;
  }
  return res;
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------
export function computeRank(input: RankInput, opts: { detailDays?: number } = {}): RankResult {
  const threshold = Number.isFinite(input.threshold) ? clamp(Math.round(input.threshold), 1, 100) : 80;
  const empty = (from: IsoDate, to: IsoDate): RankResult => ({
    version: RANK_ALGORITHM_VERSION,
    from,
    to,
    threshold,
    global: emptyScope(),
    categories: {},
    habits: {},
    days: [],
  });
  const today = input.today;
  if (!isIsoDate(today) || !isIsoDate(input.from) || input.from > today) {
    return empty(input.from, input.today);
  }
  const from = diffDays(today, input.from) > RANK_CONFIG.maxRangeDays ? addDays(today, -RANK_CONFIG.maxRangeDays) : input.from;
  const days: IsoDate[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) days.push(d);

  const revs = sanitizeRevisions(input.revisions ?? []);

  // Registros válidos, dentro del rango y de hábitos conocidos. Duplicados: gana el más reciente.
  const logs = new Map<string, Map<IsoDate, RankLog>>();
  for (const l of input.logs ?? []) {
    if (!l || !revs.has(l.habitId) || !isIsoDate(l.date) || l.date < from || l.date > today || !STATUSES.has(l.status)) continue;
    let m = logs.get(l.habitId);
    if (!m) logs.set(l.habitId, (m = new Map()));
    const prev = m.get(l.date);
    if (!prev || (l.recordedOn ?? "") >= (prev.recordedOn ?? "")) m.set(l.date, l);
  }

  const habitIds = [...revs.keys()];
  const cells = new Map(habitIds.map((id) => [id, buildCells(days, today, revs.get(id)!, logs.get(id) ?? new Map())]));

  const scope = (ids: string[]) => {
    const list = ids.map((id) => cells.get(id)!);
    const daily = applySkipBudget(aggregate(list, days.length, false));
    const hard = applySkipBudget(aggregate(list, days.length, true));
    return { daily, rank: trajectory(days, today, threshold, daily, hard) };
  };

  const global = scope(habitIds);

  const categories: Partial<Record<HabitCategory, ScopeRank>> = {};
  const byCategory = new Map<HabitCategory, string[]>();
  for (const id of habitIds) {
    // Categoría = la de la versión más reciente (clasificación, no afecta al score global).
    const list = revs.get(id)!;
    const cat = list[list.length - 1].category;
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), id]);
  }
  for (const [cat, ids] of byCategory) {
    const r = scope(ids).rank;
    if (r.scoredDays > 0) categories[cat] = r;
  }

  const habits: Record<string, ScopeRank> = {};
  for (const id of habitIds) {
    const r = scope([id]).rank;
    if (r.scoredDays > 0) habits[id] = { ...r, history: [] };
  }

  const detail = Math.max(0, opts.detailDays ?? 8);
  const dayDetails: DayDetail[] = days.slice(-detail).map((date) => {
    const i = days.indexOf(date);
    const weights: Record<string, number> = {};
    const completed: string[] = [];
    for (const id of habitIds) {
      const c = cells.get(id)![i];
      if (!c) continue;
      weights[id] = c.weight;
      if (c.completed) completed.push(id);
    }
    return {
      date,
      required: round2(global.daily[i].required),
      done: round2(global.daily[i].done),
      dailyScore: global.daily[i].score === null ? null : round2(global.daily[i].score!),
      weights,
      completed,
    };
  });

  return { version: RANK_ALGORITHM_VERSION, from, to: today, threshold, global: global.rank, categories, habits, days: dayDetails };
}

export function tierLabel(index: number | null): string {
  return index === null ? "Sin rango" : getTier(index).name;
}
