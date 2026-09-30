import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  diffDays,
  eachDay,
  endOfMonth,
  formatMinutes,
  isIsoDate,
  isoWeekday,
  isValidTimeZone,
  monthGrid,
  startOfIsoWeek,
  timeInTimeZone,
  todayInTimeZone,
} from "./dates";

describe("todayInTimeZone", () => {
  // 2026-03-02T23:30:00Z = lunes 23:30 UTC
  const instant = new Date("2026-03-02T23:30:00Z");

  it("devuelve el día local de cada zona horaria para el mismo instante", () => {
    expect(todayInTimeZone("UTC", instant)).toBe("2026-03-02");
    expect(todayInTimeZone("Europe/Madrid", instant)).toBe("2026-03-03"); // 00:30 del martes
    expect(todayInTimeZone("America/Mexico_City", instant)).toBe("2026-03-02"); // 17:30 del lunes
    expect(todayInTimeZone("Pacific/Kiritimati", instant)).toBe("2026-03-03");
  });

  it("no se equivoca de día en el cambio de hora (DST)", () => {
    // 29 marzo 2026: en Madrid se pasa de 02:00 a 03:00.
    expect(todayInTimeZone("Europe/Madrid", new Date("2026-03-28T23:30:00Z"))).toBe("2026-03-29");
    expect(todayInTimeZone("Europe/Madrid", new Date("2026-03-29T21:59:00Z"))).toBe("2026-03-29");
    expect(todayInTimeZone("Europe/Madrid", new Date("2026-03-29T22:00:00Z"))).toBe("2026-03-30");
  });

  it("formatea la hora local en 24h", () => {
    expect(timeInTimeZone("Europe/Madrid", new Date("2026-07-01T18:45:00Z"))).toBe("20:45");
  });
});

describe("aritmética de días", () => {
  it("suma y resta días cruzando meses, años y bisiestos", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30"); // DST no afecta
  });

  it("calcula diferencias", () => {
    expect(diffDays("2026-03-10", "2026-03-01")).toBe(9);
    expect(diffDays("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("día ISO de la semana y lunes de la semana", () => {
    expect(isoWeekday("2026-09-28")).toBe(1); // lunes
    expect(isoWeekday("2026-10-04")).toBe(7); // domingo
    expect(startOfIsoWeek("2026-10-04")).toBe("2026-09-28");
    expect(startOfIsoWeek("2026-09-28")).toBe("2026-09-28");
  });

  it("meses", () => {
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(eachDay("2026-01-30", "2026-02-02")).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  });

  it("rejilla mensual empieza en lunes y tiene semanas completas", () => {
    const grid = monthGrid("2026-09"); // 1 sept 2026 = martes
    expect(grid[0][0]).toBeNull();
    expect(grid[0][1]).toBe("2026-09-01");
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
  });
});

describe("validadores", () => {
  it("isIsoDate rechaza fechas imposibles o mal formadas", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(isIsoDate("2026-02-03T00:00")).toBe(false);
    expect(isIsoDate("'; drop table")).toBe(false);
  });

  it("isValidTimeZone", () => {
    expect(isValidTimeZone("Europe/Madrid")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });

  it("formatMinutes", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(400)).toBe("6 h 40 min");
  });
});
