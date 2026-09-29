import { describe, expect, it } from "vitest";
import { addDays, isoWeekday } from "../dates";
import {
  applySkipBudget,
  computeRank,
  localDateOf,
  normalizeWeight,
  phaseFor,
  RANK_CONFIG,
  RANK_WEIGHTS,
  type RankHabitRevision,
  type RankInput,
  type RankLog,
  type RankResult,
} from "./engine";
import { LEGEND_INDEX, MAX_TIER_BELOW_LEGEND, TIERS, tierIndexForScore } from "./tiers";

const START = "2026-01-05"; // lunes

function habit(id: string, over: Partial<RankHabitRevision> = {}): RankHabitRevision {
  return {
    habitId: id,
    effectiveFrom: "1970-01-01",
    weight: 1,
    category: "mental",
    frequency: "daily",
    weekdays: [],
    weeklyTarget: null,
    isOptional: false,
    isActive: true,
    archived: false,
    startsOn: START,
    ...over,
  };
}

/** Genera logs: `pick(dayIndex, habitId)` decide el estado de cada día (undefined = sin registro). */
function logsFor(
  ids: string[],
  days: number,
  pick: (i: number, id: string) => RankLog["status"] | undefined,
  from = START,
): RankLog[] {
  const out: RankLog[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    for (const id of ids) {
      const status = pick(i, id);
      if (status) out.push({ habitId: id, date, status, recordedOn: date });
    }
  }
  return out;
}

function run(revisions: RankHabitRevision[], logs: RankLog[], days: number, over: Partial<RankInput> = {}): RankResult {
  return computeRank({ from: START, today: addDays(START, days - 1), threshold: 80, revisions, logs, ...over });
}

const IDS = ["a", "b", "c", "d", "e"];
const five = IDS.map((id) => habit(id));

function assertSane(r: RankResult) {
  const scopes = [r.global, ...Object.values(r.categories), ...Object.values(r.habits)];
  for (const s of scopes) {
    if (!s) continue;
    for (const v of [s.score, s.progress, s.consistency, s.peakScore, ...(s.components ? Object.values(s.components) : [])]) {
      if (v === null) continue;
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    if (s.tierIndex !== null) {
      expect(s.tierIndex).toBeGreaterThanOrEqual(0);
      expect(s.tierIndex).toBeLessThanOrEqual(LEGEND_INDEX);
    }
  }
  let prev: number | null = null;
  for (const p of r.global.history) {
    if (p.dailyScore !== null) expect(Number.isFinite(p.dailyScore)).toBe(true);
    if (p.tierIndex !== null && prev !== null) expect(Math.abs(p.tierIndex - prev)).toBeLessThanOrEqual(1);
    if (p.tierIndex !== null) prev = p.tierIndex;
  }
}

describe("tiers", () => {
  it("25 divisiones ordenadas, Leyenda arriba", () => {
    expect(TIERS).toHaveLength(25);
    expect(TIERS[0].name).toBe("Hierro I");
    expect(TIERS[LEGEND_INDEX].name).toBe("Leyenda");
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].min - TIERS[i - 1].min).toBeGreaterThan(RANK_CONFIG.maxDailyRise);
      expect(TIERS[i].min - TIERS[i - 1].min).toBeGreaterThan(RANK_CONFIG.maxDailyDrop);
    }
  });
  it("mapea scores a divisiones sin rangos imposibles", () => {
    expect(tierIndexForScore(0)).toBe(0);
    expect(tierIndexForScore(-10)).toBe(0);
    expect(tierIndexForScore(Number.NaN)).toBe(0);
    expect(tierIndexForScore(100)).toBe(LEGEND_INDEX);
    expect(TIERS[tierIndexForScore(50)].name).toBe("Oro III");
  });
  it("los pesos del score suman 1", () => {
    expect(Object.values(RANK_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe("rank engine", () => {
  it("1. 100 % completado: sube, se estabiliza y alcanza Leyenda sólo tras semanas", () => {
    const r30 = run(five, logsFor(IDS, 30, () => "done"), 30);
    assertSane(r30);
    expect(r30.global.completeDays).toBe(30);
    expect(r30.global.tierIndex).toBeLessThan(LEGEND_INDEX); // 30 días no bastan para Leyenda
    const r60 = run(five, logsFor(IDS, 60, () => "done"), 60);
    assertSane(r60);
    expect(r60.global.phase).toBe("stable");
    expect(r60.global.tierIndex).toBe(LEGEND_INDEX);
  });

  it("2. 0 % completado: cae a Hierro sin bajar de 0", () => {
    const r = run(five, logsFor(IDS, 40, () => "missed"), 40);
    assertSane(r);
    expect(r.global.failedDays).toBe(40);
    expect(r.global.score!).toBeLessThan(TIERS[3].min);
    expect(r.global.currentStreak).toBe(0);
  });

  it("3. cumplimiento parcial: 3 de 5 cada día → rango medio", () => {
    const r = run(five, logsFor(IDS, 40, (_, id) => (["a", "b", "c"].includes(id) ? "done" : "missed")), 40);
    assertSane(r);
    expect(r.days.at(-1)!.dailyScore).toBe(60);
    expect(r.global.partialDays).toBe(40);
    expect(r.global.score!).toBeGreaterThan(30);
    expect(r.global.score!).toBeLessThan(62);
  });

  it("4. pesos: entreno 2 + estudio 2 + lectura 1 de 6 → 83,33 %", () => {
    const revs = [habit("train", { weight: 2 }), habit("study", { weight: 2 }), habit("read"), habit("reflect")];
    const r = run(revs, logsFor(["train", "study", "read"], 1, () => "done"), 1);
    expect(r.days[0].dailyScore).toBeCloseTo(83.33, 2);
    expect(r.days[0].weights).toEqual({ train: 2, study: 2, read: 1, reflect: 1 });
    expect(r.days[0].completed.sort()).toEqual(["read", "study", "train"]);
  });

  it("5. días de descanso programados: no cuentan, no rompen racha, no bajan el score", () => {
    const revs = [habit("w", { frequency: "weekdays", weekdays: [1, 2, 3, 4, 5] })];
    const r = run(revs, logsFor(["w"], 21, (i) => (isoWeekday(addDays(START, i)) <= 5 ? "done" : undefined)), 21);
    assertSane(r);
    expect(r.global.restDays).toBe(5); // el último domingo es hoy: aún no cuenta
    expect(r.global.currentStreak).toBe(15);
    const sat = r.global.history.find((p) => p.date === addDays(START, 5))!;
    const fri = r.global.history.find((p) => p.date === addDays(START, 4))!;
    expect(sat.dailyScore).toBeNull();
    expect(sat.score).toBe(fri.score);
  });

  it("6. racha actual y mejor racha", () => {
    const r = run(five, logsFor(IDS, 10, () => "done"), 10);
    expect(r.global.currentStreak).toBe(10);
    expect(r.global.bestStreak).toBe(10);
  });

  it("7. pérdida de racha: la mejor se conserva", () => {
    const r = run(five, logsFor(IDS, 14, (i) => (i === 10 ? "missed" : "done")), 14);
    expect(r.global.currentStreak).toBe(3);
    expect(r.global.bestStreak).toBe(10);
  });

  it("8. subida de rango gradual: nunca más de una división por día", () => {
    const r = run(five, logsFor(IDS, 60, () => "done"), 60);
    const tiers = r.global.history.map((p) => p.tierIndex!).filter((t) => t !== null);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i] - tiers[i - 1]).toBeGreaterThanOrEqual(0);
      expect(tiers[i] - tiers[i - 1]).toBeLessThanOrEqual(1);
    }
    expect(tiers.at(-1)!).toBeGreaterThan(tiers[0]);
  });

  it("9. descenso: gradual (≤1,5 pts/día) y con suelo sobre el mejor nivel", () => {
    const r = run(five, logsFor(IDS, 70, (i) => (i < 40 ? "done" : "missed")), 70);
    assertSane(r);
    const scores = r.global.history.map((p) => p.score!);
    for (let i = 41; i < scores.length; i++) {
      expect(scores[i - 1] - scores[i]).toBeLessThanOrEqual(RANK_CONFIG.maxDailyDrop + 1e-9);
    }
    expect(r.global.score!).toBeLessThan(r.global.peakScore!);
    expect(r.global.score!).toBeGreaterThanOrEqual(r.global.peakScore! * RANK_CONFIG.peakFloorRatio - 0.01);
    // Un único mal día no hunde meses de progreso.
    const oneBad = run(five, logsFor(IDS, 41, (i) => (i === 40 ? "missed" : "done")), 41, { today: addDays(START, 41) });
    const before = oneBad.global.history[39].score!;
    const after = oneBad.global.history[40].score!;
    expect(before - after).toBeLessThanOrEqual(RANK_CONFIG.maxDailyDrop);
  });

  it("10. recuperación tras una mala racha", () => {
    const r = run(five, logsFor(IDS, 60, (i) => (i < 20 || i >= 35 ? "done" : "missed")), 60);
    const atBottom = r.global.history[34].score!;
    expect(r.global.score!).toBeGreaterThan(atBottom);
    expect(r.global.components!.progress).toBeGreaterThan(50);
  });

  it("11. cambiar el peso de un hábito no recalcula el pasado", () => {
    const logs = logsFor(IDS, 30, (i, id) => (id === "a" && i % 2 ? "missed" : "done"));
    const base = run(five, logs, 30);
    const changed = run([...five, habit("a", { weight: 2, effectiveFrom: addDays(START, 20) })], logs, 30);
    expect(changed.global.history.slice(0, 20)).toEqual(base.global.history.slice(0, 20));
    expect(changed.days.at(-1)!.weights.a).toBe(2);
  });

  it("12. archivar un hábito no borra su efecto en el pasado", () => {
    const logs = logsFor(IDS, 30, (_, id) => (id === "e" ? "missed" : "done"));
    const base = run(five, logs, 30);
    const archived = run([...five, habit("e", { archived: true, isActive: false, effectiveFrom: addDays(START, 20) })], logs, 30);
    expect(archived.global.history.slice(0, 20)).toEqual(base.global.history.slice(0, 20));
    expect(archived.days.at(-1)!.dailyScore).toBe(100);
    expect(base.days.at(-1)!.dailyScore).toBe(80);
  });

  it("13. usuario nuevo: provisional con confianza baja; sin datos = sin rango", () => {
    const r = run(five, logsFor(IDS, 1, () => "done"), 1);
    expect(r.global.phase).toBe("provisional");
    expect(r.global.score!).toBeLessThan(50); // no hay falsa precisión con 1 día
    const none = run([], [], 1);
    expect(none.global.phase).toBe("none");
    expect(none.global.score).toBeNull();
    expect(none.global.tierIndex).toBeNull();
  });

  it("14. usuario con 30+ días: rango estabilizado", () => {
    const r = run(five, logsFor(IDS, 45, (i) => (i % 5 === 0 ? "missed" : "done")), 45);
    assertSane(r);
    expect(r.global.phase).toBe("stable");
    expect(r.global.scoredDays).toBe(45);
    expect(phaseFor(3)).toBe("provisional");
    expect(phaseFor(5)).toBe("estimated");
    expect(phaseFor(10)).toBe("stabilizing");
  });

  describe("15. manipulación", () => {
    it("añadir muchos hábitos no infla el score (normalización)", () => {
      // Misma proporción (2/3) con 6 o con 30 hábitos → mismo score.
      const fewIds = ["u", "v", "w", "x", "y", "z"];
      const few = run(
        fewIds.map((id) => habit(id)),
        logsFor(fewIds, 30, (_, id) => (id === "y" || id === "z" ? "missed" : "done")),
        30,
      );
      const manyIds = Array.from({ length: 30 }, (_, i) => `h${i}`);
      const many = run(
        manyIds.map((id) => habit(id)),
        logsFor(manyIds, 30, (_, id) => (Number(id.slice(1)) % 3 === 2 ? "missed" : "done")),
        30,
      );
      expect(many.global.score).toBeCloseTo(few.global.score!, 5);
    });

    it("marcar todo como «no aplica» no convierte un día en descanso", () => {
      const r = run(five, logsFor(IDS, 20, () => "skipped"), 20);
      expect(r.global.restDays).toBe(0);
      expect(r.global.score!).toBeLessThan(30);
      // Un «no aplica» ocasional sí es neutro.
      const occasional = run(five, logsFor(IDS, 7, (i, id) => (i === 3 && id === "a" ? "skipped" : "done")), 7);
      expect(occasional.global.history[3].dailyScore).toBe(100);
    });

    it("cupo de «no aplica» por ventana de 7 días", () => {
      const days = applySkipBudget(Array.from({ length: 7 }, () => ({ sched: 5, done: 0, skip: 5 })));
      const neutral = days.reduce((acc, d) => acc + (5 - d.required), 0);
      expect(neutral).toBeLessThanOrEqual(RANK_CONFIG.skipAllowance * 35 + 1e-9);
    });

    it("registrar días pasados con retraso vale menos", () => {
      const onTime = run(five, logsFor(IDS, 10, () => "done"), 10);
      const late = run(
        five,
        logsFor(IDS, 10, () => "done").map((l) => ({ ...l, recordedOn: addDays(l.date, 5) })),
        10,
        { today: addDays(START, 14) },
      );
      expect(late.global.history[9].dailyScore).toBeCloseTo(100 * RANK_CONFIG.lateLogFactor, 5);
      expect(onTime.global.history[9].dailyScore).toBe(100);
    });

    it("una rutina de un solo hábito fácil no llega a Leyenda", () => {
      const r = run([habit("solo")], logsFor(["solo"], 90, () => "done"), 90);
      expect(r.global.tierIndex!).toBeLessThan(LEGEND_INDEX);
      expect(r.global.demandFactor).toBeLessThan(1);
    });

    it("los pesos imposibles se normalizan", () => {
      expect(normalizeWeight(50)).toBe(2);
      expect(normalizeWeight(-3)).toBe(1);
      expect(normalizeWeight(Number.NaN)).toBe(1);
      expect(normalizeWeight(1.4)).toBe(1.5);
      const r = run([habit("x", { weight: 999 }), habit("y")], logsFor(["y"], 1, () => "done"), 1);
      expect(r.days[0].dailyScore).toBeCloseTo(33.33, 2);
    });

    it("hoy (día en curso) nunca penaliza", () => {
      const logs = logsFor(IDS, 20, (i) => (i < 19 ? "done" : undefined));
      const r = run(five, logs, 20);
      expect(r.global.history[19].score).toBe(r.global.history[18].score);
      expect(r.global.currentStreak).toBe(19);
    });
  });

  it("16. datos incompletos: hábitos desconocidos, estados raros, pesos NaN", () => {
    const logs: RankLog[] = [
      { habitId: "ghost", date: START, status: "done", recordedOn: START },
      { habitId: "a", date: START, status: "weird" as RankLog["status"], recordedOn: null },
      { habitId: "b", date: START, status: "done", recordedOn: null },
    ];
    const r = run([habit("a", { weight: Number.NaN }), habit("b"), habit("c", { weekdays: null as unknown as number[] })], logs, 3);
    assertSane(r);
    expect(r.days[0].dailyScore).toBeCloseTo(33.33, 2);
  });

  it("17. fechas incorrectas: no rompe y descarta registros fuera de rango", () => {
    expect(() => computeRank({ from: "2026-02-10", today: "2026-02-01", threshold: 80, revisions: five, logs: [] })).not.toThrow();
    expect(computeRank({ from: "nope", today: "2026-02-01", threshold: 80, revisions: five, logs: [] }).global.phase).toBe("none");
    expect(computeRank({ from: START, today: "2026-13-45", threshold: 80, revisions: five, logs: [] }).global.phase).toBe("none");
    const r = run(
      five,
      [
        { habitId: "a", date: "2026-02-30", status: "done", recordedOn: null },
        { habitId: "a", date: addDays(START, 100), status: "done", recordedOn: null },
        { habitId: "a", date: addDays(START, -3), status: "done", recordedOn: null },
      ],
      2,
    );
    assertSane(r);
    expect(r.days.every((d) => d.completed.length === 0)).toBe(true);
    // Rango enorme: se limita a 400 días.
    const huge = computeRank({ from: "2000-01-01", today: "2026-06-01", threshold: 80, revisions: five, logs: [] });
    expect(huge.from).toBe(addDays("2026-06-01", -400));
    // Umbral no válido → 80.
    expect(run(five, [], 2, { threshold: Number.NaN }).threshold).toBe(80);
  });

  it("18. zona horaria: el día de registro depende de la zona del usuario (incl. cambio de hora)", () => {
    expect(localDateOf("2026-03-29T23:30:00Z", "Europe/Madrid")).toBe("2026-03-30");
    expect(localDateOf("2026-03-29T23:30:00Z", "America/Los_Angeles")).toBe("2026-03-29");
    expect(localDateOf("2026-10-25T00:30:00Z", "Europe/Madrid")).toBe("2026-10-25");
    expect(localDateOf("no-date", "Europe/Madrid")).toBeNull();
    expect(localDateOf("2026-03-29T23:30:00Z", "Mars/Olympus")).toBeNull();
    expect(localDateOf(null, "UTC")).toBeNull();
  });

  it("19. doble registro del mismo día cuenta una sola vez", () => {
    const single = run(five, logsFor(IDS, 5, () => "done"), 5);
    const dup = run(five, [...logsFor(IDS, 5, () => "done"), ...logsFor(IDS, 5, () => "done")], 5);
    expect(dup.global).toEqual(single.global);
    // Si hay conflicto, gana la modificación más reciente.
    const conflict = run(
      [habit("a")],
      [
        { habitId: "a", date: START, status: "done", recordedOn: START },
        { habitId: "a", date: START, status: "missed", recordedOn: addDays(START, 1) },
      ],
      2,
    );
    expect(conflict.days[0].dailyScore).toBe(0);
  });

  it("20. reinicio de la app: el cálculo es determinista y reconstruible", () => {
    const input: RankInput = { from: START, today: addDays(START, 29), threshold: 80, revisions: five, logs: logsFor(IDS, 30, (i) => (i % 3 ? "done" : "missed")) };
    const first = computeRank(input);
    const second = computeRank(JSON.parse(JSON.stringify(input)));
    expect(second).toEqual(first);
  });

  it("objetivo semanal: se mide por semanas y no penaliza el inicio de semana", () => {
    const revs = [habit("train", { frequency: "weekly_target", weeklyTarget: 3, weight: 1.5 })];
    // 3 entrenos (lun, mié, vie) cada semana → 100 % en semanas cerradas.
    const logs = logsFor(["train"], 14, (i) => ([0, 2, 4].includes(i % 7) ? "done" : undefined));
    const r = run(revs, logs, 14);
    expect(r.global.history[6].dailyScore).toBe(100);
    expect(r.global.history[13].dailyScore).toBe(100);
    // Semana en curso: lunes con 1 entreno ya va al día.
    const monday = run(revs, logsFor(["train"], 1, () => "done"), 1);
    expect(monday.days[0].dailyScore).toBe(100);
  });

  it("rangos por categoría y por hábito", () => {
    const revs = [habit("run", { category: "physical" }), habit("read", { category: "mental" })];
    const r = run(revs, logsFor(["run", "read"], 30, (_, id) => (id === "run" ? "done" : "missed")), 30);
    expect(r.categories.physical!.score!).toBeGreaterThan(r.categories.mental!.score!);
    expect(r.habits.run.tierIndex!).toBeGreaterThan(r.habits.read.tierIndex!);
    expect(r.categories.productivity).toBeUndefined();
  });

  it("fuzz: nunca NaN, fuera de 0–100 ni saltos de varias divisiones", () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let t = 0; t < 25; t++) {
      const revs = IDS.map((id) => habit(id, { weight: [1, 1.5, 2][Math.floor(rand() * 3)], frequency: rand() < 0.2 ? "weekly_target" : "daily", weeklyTarget: 3 }));
      const statuses = ["done", "missed", "skipped", undefined] as const;
      const r = run(revs, logsFor(IDS, 80, () => statuses[Math.floor(rand() * 4)]), 80);
      assertSane(r);
      if (r.global.tierIndex === LEGEND_INDEX) expect(r.global.scoredDays).toBeGreaterThanOrEqual(RANK_CONFIG.legendMinDays);
      expect(r.global.tierIndex!).toBeLessThanOrEqual(Math.max(MAX_TIER_BELOW_LEGEND, r.global.tierIndex!));
    }
  });
});
