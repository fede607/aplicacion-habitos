import { describe, expect, it } from "vitest";
import { buildYearLine, linePath } from "./year-line";

const day = (d: string, required: number, completed: number) => ({ day: d, required, completed, skipped: 0, bonus: 0 });

describe("year line", () => {
  it("sin datos no hay línea", () => {
    expect(buildYearLine([], 2026, "2026-10-01").points).toEqual([]);
  });

  it("empieza el primer día registrado y llega hasta hoy", () => {
    const y = buildYearLine([day("2026-09-28", 4, 4)], 2026, "2026-10-01");
    expect(y.points.map((p) => p.date)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]);
  });

  it("media móvil de 7 días ponderada por hábitos", () => {
    const y = buildYearLine([day("2026-01-01", 4, 4), day("2026-01-02", 4, 0)], 2026, "2026-01-02");
    expect(y.points.map((p) => p.value)).toEqual([100, 50]);
    expect(y.current).toBe(50);
    expect(y.perfectDays).toBe(1);
  });

  it("no cuenta de más si completas más de lo obligatorio", () => {
    expect(buildYearLine([day("2026-03-01", 2, 5)], 2026, "2026-03-01").current).toBe(100);
  });

  it("los días sin hábitos no bajan la media", () => {
    const y = buildYearLine([day("2026-01-01", 2, 2), day("2026-01-02", 0, 0)], 2026, "2026-01-02");
    expect(y.points[1].value).toBe(100);
  });

  it("cambio frente a hace 30 días", () => {
    const series = [day("2026-01-01", 2, 1), ...Array.from({ length: 7 }, (_, i) => day(`2026-01-${String(25 + i).padStart(2, "0")}`, 2, 2))];
    const y = buildYearLine(series, 2026, "2026-01-31");
    expect(y.current).toBe(100);
    expect(y.delta30).toBe(50);
  });

  it("ruta SVG: 0 % abajo, 100 % arriba, huecos cortan la línea", () => {
    expect(
      linePath(
        [
          { date: "2026-01-01", value: 0 },
          { date: "2026-01-02", value: 100 },
          { date: "2026-01-03", value: null },
          { date: "2026-01-04", value: 50 },
        ],
        300,
        100,
      ),
    ).toBe("M0.0 100.0 L100.0 0.0 M300.0 50.0");
  });
});
