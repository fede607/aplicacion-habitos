import { describe, expect, it } from "vitest";
import { compareMonths, csvCell, habitTrends, monthToDatePeriods, toCsv, weekdayPattern } from "./analytics";
import type { DayStat } from "./stats";

const day = (d: string, required: number, completed: number): DayStat => ({ day: d, required, completed, skipped: 0, bonus: 0 });

describe("monthToDatePeriods", () => {
  it("compara el mismo tramo de días", () => {
    expect(monthToDatePeriods("2026-10-15")).toEqual({
      current: { from: "2026-10-01", to: "2026-10-15" },
      previous: { from: "2026-09-01", to: "2026-09-15" },
    });
  });
  it("recorta al final del mes anterior si es más corto", () => {
    expect(monthToDatePeriods("2026-03-31").previous).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
  it("cruza de año", () => {
    expect(monthToDatePeriods("2027-01-05").previous).toEqual({ from: "2026-12-01", to: "2026-12-05" });
  });
});

describe("compareMonths", () => {
  it("calcula la diferencia en puntos", () => {
    const series = [day("2026-09-01", 10, 5), day("2026-09-02", 10, 5), day("2026-10-01", 10, 8), day("2026-10-02", 10, 9)];
    const r = compareMonths(series, "2026-10-02");
    expect(r.current.percent).toBe(85);
    expect(r.previous.percent).toBe(50);
    expect(r.deltaPoints).toBe(35);
  });
  it("sin datos del mes anterior no inventa diferencia", () => {
    expect(compareMonths([day("2026-10-01", 10, 8)], "2026-10-01").deltaPoints).toBeNull();
  });
});

describe("weekdayPattern", () => {
  it("agrupa por día de la semana (lunes = 1)", () => {
    // 2026-09-28 es lunes; 2026-10-05 también.
    const p = weekdayPattern([day("2026-09-28", 10, 10), day("2026-10-05", 10, 0), day("2026-09-29", 10, 7)], "2026-09-01", "2026-10-31");
    expect(p[0]).toMatchObject({ weekday: 1, percent: 50 });
    expect(p[1]).toMatchObject({ weekday: 2, percent: 70 });
    expect(p[2].percent).toBeNull();
  });
  it("no cuenta completados por encima de lo requerido", () => {
    expect(weekdayPattern([day("2026-09-28", 5, 9)], "2026-09-01", "2026-09-30")[0].percent).toBe(100);
  });
});

describe("habitTrends", () => {
  const habit = {
    id: "h1",
    name: "Leer",
    frequency: "daily" as const,
    weekdays: [],
    weekly_target: null,
    is_optional: false,
    is_active: true,
    starts_on: "2026-08-01",
  };
  it("compara % de cada hábito", () => {
    const logs = new Map([["h1", new Map([["2026-10-01", "done"], ["2026-09-01", "done"], ["2026-09-02", "missed"]])]]);
    const [t] = habitTrends([habit], logs, "2026-10-02");
    expect(t).toMatchObject({ current: 50, previous: 50, delta: 0 });
  });
  it("ignora opcionales y objetivos semanales", () => {
    expect(habitTrends([{ ...habit, is_optional: true }, { ...habit, id: "h2", frequency: "weekly_target" as const, weekly_target: 3 }], new Map(), "2026-10-02")).toEqual([]);
  });
});

describe("CSV", () => {
  it("escapa comillas, comas y saltos de línea", () => {
    expect(csvCell('hola, "tú"')).toBe('"hola, ""tú"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
  });
  it("neutraliza fórmulas (inyección CSV)", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM")).toBe("'@SUM");
  });
  it("genera filas con CRLF", () => {
    expect(toCsv(["a", "b"], [[1, 2]])).toBe("a,b\r\n1,2\r\n");
  });
});
