import { describe, expect, it } from "vitest";
import { buildYearPixels, levelFor } from "./year-pixels";

const day = (d: string, required: number, completed: number, bonus = 0) => ({ day: d, required, completed, skipped: 0, bonus });

describe("year pixels", () => {
  it("niveles por porcentaje", () => {
    expect([0, 30, 50, 85, 100].map(levelFor)).toEqual([0, 1, 2, 3, 4]);
  });

  it("12 meses con sus días reales (bisiesto incluido)", () => {
    const y = buildYearPixels([], 2028, "2028-12-31");
    expect(y.months.map((m) => m.length)).toEqual([31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });

  it("pinta cada día y cuenta los perfectos", () => {
    const y = buildYearPixels([day("2026-01-01", 4, 4), day("2026-01-02", 4, 1), day("2026-01-03", 0, 0), day("2026-01-04", 0, 0, 1)], 2026, "2026-01-05");
    const jan = y.months[0];
    expect(jan[0]).toMatchObject({ level: 4, percent: 100 });
    expect(jan[1].level).toBe(1);
    expect(jan[2].level).toBe("rest");
    expect(jan[3].level).toBe(2);
    expect(jan[4].level).toBe("none");
    expect(jan[5].level).toBe("future");
    expect(y.perfectDays).toBe(1);
    expect(y.trackedDays).toBe(2);
  });

  it("no cuenta de más si completas más de lo obligatorio", () => {
    const y = buildYearPixels([day("2026-03-01", 2, 5)], 2026, "2026-03-01");
    expect(y.months[2][0].percent).toBe(100);
  });

  it("mejor mes con al menos 5 días", () => {
    const series = [
      ...Array.from({ length: 5 }, (_, i) => day(`2026-02-0${i + 1}`, 2, 2)),
      ...Array.from({ length: 5 }, (_, i) => day(`2026-03-0${i + 1}`, 2, 1)),
      day("2026-04-01", 1, 1),
    ];
    expect(buildYearPixels(series, 2026, "2026-04-30").bestMonth).toBe(1);
  });
});
