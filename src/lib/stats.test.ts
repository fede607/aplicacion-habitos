import { describe, expect, it } from "vitest";
import {
  computeStreaks,
  computeXp,
  dayLevel,
  dayPercent,
  habitStreak,
  isGoodDay,
  isRequiredOn,
  isScheduledOn,
  levelFromXp,
  summarize,
  weeklyTargetProgress,
  xpForLevel,
  type DayStat,
  type ScheduleHabit,
} from "./stats";
import { addDays } from "./dates";
import type { HabitLogStatus } from "./database.types";

const day = (
  d: string,
  required: number,
  completed: number,
  extra: Partial<DayStat> = {},
): DayStat => ({
  day: d,
  required,
  completed,
  skipped: 0,
  bonus: 0,
  ...extra,
});

const habit = (over: Partial<ScheduleHabit> = {}): ScheduleHabit => ({
  frequency: "daily",
  weekdays: [],
  weekly_target: null,
  is_optional: false,
  is_active: true,
  starts_on: "2026-01-01",
  ...over,
});

describe("programación de hábitos", () => {
  it("diario, días concretos, objetivo semanal y opcional", () => {
    // 2026-09-28 es lunes, 2026-09-29 martes
    expect(isRequiredOn(habit(), "2026-09-28")).toBe(true);
    const boxing = habit({ frequency: "weekdays", weekdays: [2, 4, 6] });
    expect(isRequiredOn(boxing, "2026-09-28")).toBe(false);
    expect(isRequiredOn(boxing, "2026-09-29")).toBe(true);
    const weekly = habit({ frequency: "weekly_target", weekly_target: 4 });
    expect(isScheduledOn(weekly, "2026-09-28")).toBe(true);
    expect(isRequiredOn(weekly, "2026-09-28")).toBe(false);
    expect(isRequiredOn(habit({ is_optional: true }), "2026-09-28")).toBe(
      false,
    );
  });

  it("respeta starts_on e is_active", () => {
    expect(isRequiredOn(habit({ starts_on: "2026-10-01" }), "2026-09-30")).toBe(
      false,
    );
    expect(isRequiredOn(habit({ is_active: false }), "2026-09-30")).toBe(false);
  });
});

describe("porcentajes", () => {
  it("dayPercent", () => {
    expect(dayPercent(day("2026-01-01", 8, 6))).toBe(75);
    expect(dayPercent(day("2026-01-01", 0, 0))).toBeNull();
    expect(dayPercent(day("2026-01-01", 3, 5))).toBe(100);
  });

  it("isGoodDay usa el umbral del grupo", () => {
    expect(isGoodDay(day("x", 10, 8), 80)).toBe(true);
    expect(isGoodDay(day("x", 10, 7), 80)).toBe(false);
    expect(isGoodDay(day("x", 0, 0), 80)).toBe(false);
  });

  it("summarize suma obligatorios y completados del rango", () => {
    const stats = [
      day("2026-01-01", 5, 5),
      day("2026-01-02", 5, 3, { bonus: 1 }),
      day("2026-01-03", 5, 0),
      day("2026-01-04", 0, 0),
    ];
    expect(summarize(stats, "2026-01-01", "2026-01-03")).toEqual({
      required: 15,
      completed: 8,
      percent: 53,
      activeDays: 2,
    });
    expect(summarize(stats, "2026-01-04", "2026-01-04").percent).toBeNull();
  });

  it("dayLevel clasifica para el calendario", () => {
    const today = "2026-01-10";
    expect(dayLevel(day("2026-01-09", 10, 10), 80, "2026-01-09", today)).toBe(
      "complete",
    );
    expect(dayLevel(day("2026-01-09", 10, 5), 80, "2026-01-09", today)).toBe(
      "partial",
    );
    expect(dayLevel(day("2026-01-09", 10, 1), 80, "2026-01-09", today)).toBe(
      "low",
    );
    expect(dayLevel(day("2026-01-09", 10, 0), 80, "2026-01-09", today)).toBe(
      "none",
    );
    expect(
      dayLevel(day("2026-01-09", 0, 0, { bonus: 2 }), 80, "2026-01-09", today),
    ).toBe("rest");
    expect(dayLevel(undefined, 80, "2026-01-11", today)).toBe("future");
  });
});

describe("rachas", () => {
  const series = (values: [number, number][], start = "2026-01-01") =>
    values.map(([r, c], i) => day(addDays(start, i), r, c));

  it("cuenta días consecutivos cumplidos hasta hoy", () => {
    const s = series([
      [5, 5],
      [5, 5],
      [5, 1],
      [5, 5],
      [5, 4],
      [5, 5],
    ]);
    expect(computeStreaks(s, 80, "2026-01-06")).toEqual({
      current: 3,
      best: 3,
    });
  });

  it("hoy sin completar no rompe la racha", () => {
    const s = series([
      [5, 5],
      [5, 5],
      [5, 0],
    ]);
    expect(computeStreaks(s, 80, "2026-01-03")).toEqual({
      current: 2,
      best: 2,
    });
  });

  it("los días de descanso ni suman ni rompen", () => {
    const s = series([
      [5, 5],
      [0, 0],
      [5, 5],
      [0, 0],
    ]);
    expect(computeStreaks(s, 80, "2026-01-04")).toEqual({
      current: 2,
      best: 2,
    });
  });

  it("un día fallado reinicia la racha actual pero conserva la mejor", () => {
    const s = series([
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 0],
      [5, 5],
    ]);
    expect(computeStreaks(s, 80, "2026-01-06")).toEqual({
      current: 1,
      best: 4,
    });
  });

  it("si la serie acaba antes de ayer, la racha actual es 0", () => {
    const s = series([
      [5, 5],
      [5, 5],
    ]);
    expect(computeStreaks(s, 80, "2026-01-10")).toEqual({
      current: 0,
      best: 2,
    });
  });

  it("ignora días futuros y acepta series desordenadas", () => {
    const s = series([
      [5, 5],
      [5, 5],
      [5, 5],
    ]).reverse();
    expect(computeStreaks(s, 80, "2026-01-02")).toEqual({
      current: 2,
      best: 2,
    });
  });

  it("serie vacía", () => {
    expect(computeStreaks([], 80, "2026-01-01")).toEqual({
      current: 0,
      best: 0,
    });
  });
});

describe("racha por hábito", () => {
  const logs = (entries: [string, HabitLogStatus][]) => new Map(entries);

  it("diario: consecutivos hechos; hoy pendiente es neutro; no aplica es neutro", () => {
    const m = logs([
      ["2026-01-01", "done"],
      ["2026-01-02", "done"],
      ["2026-01-03", "skipped"],
      ["2026-01-04", "done"],
    ]);
    expect(habitStreak(habit(), m, "2026-01-05")).toEqual({
      value: 3,
      unit: "days",
    });
    expect(habitStreak(habit(), m, "2026-01-06")).toEqual({
      value: 0,
      unit: "days",
    });
  });

  it("días concretos: sólo cuentan los días programados", () => {
    // Martes/jueves/sábado. 2026-09-29 mar, 10-01 jue, 10-03 sáb.
    const boxing = habit({ frequency: "weekdays", weekdays: [2, 4, 6] });
    const m = logs([
      ["2026-09-29", "done"],
      ["2026-10-01", "done"],
      ["2026-10-03", "done"],
    ]);
    expect(habitStreak(boxing, m, "2026-10-05").value).toBe(3);
  });

  it("no cuenta antes de starts_on", () => {
    const m = logs([["2026-01-01", "done"]]);
    expect(
      habitStreak(habit({ starts_on: "2026-01-01" }), m, "2026-01-01").value,
    ).toBe(1);
  });

  it("objetivo semanal: semanas consecutivas alcanzando el objetivo", () => {
    const weekly = habit({
      frequency: "weekly_target",
      weekly_target: 2,
      starts_on: "2026-09-01",
    });
    const m = logs([
      ["2026-09-14", "done"],
      ["2026-09-16", "done"], // semana 14-20: 2 ✔
      ["2026-09-21", "done"],
      ["2026-09-25", "done"], // semana 21-27: 2 ✔
      ["2026-09-28", "done"], // semana actual: 1 (pendiente, neutro)
    ]);
    expect(habitStreak(weekly, m, "2026-09-29")).toEqual({
      value: 2,
      unit: "weeks",
    });
    expect(weeklyTargetProgress(m, "2026-09-28", 2)).toEqual({
      done: 1,
      target: 2,
      percent: 50,
    });
  });
});

describe("XP y niveles", () => {
  it("computeXp", () => {
    expect(
      computeXp({
        habitsDone: 10,
        workouts: 2,
        noteDays: 4,
        achievementXp: 50,
      }),
    ).toBe(100 + 40 + 20 + 50);
  });

  it("niveles progresivos", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(levelFromXp(0)).toMatchObject({ level: 1, progress: 0 });
    expect(levelFromXp(150)).toMatchObject({
      level: 2,
      current: 100,
      next: 300,
      progress: 25,
    });
    expect(levelFromXp(300).level).toBe(3);
  });
});
