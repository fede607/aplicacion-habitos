import { describe, expect, it } from "vitest";
import { compareWithPast } from "./self-compare";
import { challengeProgress } from "./challenges";
import type { DayStat } from "./stats";

const day = (d: string, required: number, completed: number): DayStat => ({ day: d, required, completed, skipped: 0, bonus: 0 });

describe("compareWithPast", () => {
  it("compara los mismos días transcurridos de la semana anterior", () => {
    // Miércoles 2026-10-21: esta semana lun-mié vs lun-mié de la anterior.
    const series = [day("2026-10-12", 2, 1), day("2026-10-13", 2, 2), day("2026-10-14", 2, 0), day("2026-10-15", 2, 2), day("2026-10-19", 2, 2), day("2026-10-20", 2, 2), day("2026-10-21", 2, 1)];
    const [week] = compareWithPast(series, [{ date: "2026-10-20", minutes: 45 }, { date: "2026-10-13", minutes: 30 }], "2026-10-21");
    expect(week.now.percent).toBe(83);
    expect(week.before.percent).toBe(50);
    expect(week.now.perfectDays).toBe(2);
    expect(week.before.perfectDays).toBe(1);
    expect(week.now.minutes).toBe(45);
    expect(week.before.workouts).toBe(1);
  });
  it("el mes anterior no se sale de su último día", () => {
    const [, month] = compareWithPast([], [], "2026-03-31");
    expect(month.before.workouts).toBe(0);
  });
});

describe("challengeProgress", () => {
  it("cuenta días, racha y si se puede marcar ayer", () => {
    const p = challengeProgress({ days: 7, started_on: "2026-10-20", completed_at: null }, new Set(["2026-10-20", "2026-10-21", "2026-10-23"]), "2026-10-23");
    expect(p.done).toBe(3);
    expect(p.dayNumber).toBe(4);
    expect(p.doneToday).toBe(true);
    expect(p.streak).toBe(1);
    expect(p.canMarkYesterday).toBe(true);
    expect(p.expired).toBe(false);
  });
  it("caduca si se pasó el plazo sin completarlo", () => {
    const p = challengeProgress({ days: 7, started_on: "2026-10-01", completed_at: null }, new Set(["2026-10-01"]), "2026-10-20");
    expect(p.expired).toBe(true);
    expect(p.canMarkYesterday).toBe(false);
  });
});
