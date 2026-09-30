import { describe, expect, it } from "vitest";
import { duelLeader, duelSide, isDuelFinished } from "./duel";
import type { RankHistoryPoint } from "./engine";

const pt = (date: string, dailyScore: number | null): RankHistoryPoint => ({
  date,
  dailyScore,
  score: null,
  tierIndex: null,
  scoredDays: 0,
  currentStreak: 0,
  bestStreak: 0,
  consistency: null,
  components: null,
});

const WEEK = "2026-09-28"; // lunes

describe("duelos", () => {
  it("media sólo de los días de la semana, sin contar descansos", () => {
    const h = [
      pt("2026-09-27", 0),
      pt(WEEK, 100),
      pt("2026-09-29", 50),
      pt("2026-09-30", null),
      pt("2026-10-05", 0),
    ];
    expect(duelSide(h, WEEK, "2026-10-10", 80)).toEqual({
      average: 75,
      scoredDays: 2,
      completeDays: 1,
    });
  });

  it("durante la semana sólo cuenta hasta hoy", () => {
    const h = [pt(WEEK, 100), pt("2026-09-29", 20)];
    expect(duelSide(h, WEEK, WEEK, 80).average).toBe(100);
  });

  it("sin días puntuados no hay media", () => {
    expect(duelSide([], WEEK, "2026-10-01", 80)).toEqual({
      average: null,
      scoredDays: 0,
      completeDays: 0,
    });
  });

  it("ganador por margen, desempate por días cumplidos y empate", () => {
    expect(
      duelLeader(
        { average: 80, scoredDays: 7, completeDays: 5 },
        { average: 70, scoredDays: 7, completeDays: 6 },
      ),
    ).toBe("a");
    expect(
      duelLeader(
        { average: 80, scoredDays: 7, completeDays: 4 },
        { average: 80.2, scoredDays: 7, completeDays: 5 },
      ),
    ).toBe("b");
    expect(
      duelLeader(
        { average: 80, scoredDays: 7, completeDays: 5 },
        { average: 80, scoredDays: 7, completeDays: 5 },
      ),
    ).toBe("draw");
    expect(
      duelLeader(
        { average: null, scoredDays: 0, completeDays: 0 },
        { average: 10, scoredDays: 1, completeDays: 0 },
      ),
    ).toBe("b");
  });

  it("la semana termina el domingo", () => {
    expect(isDuelFinished(WEEK, "2026-10-04")).toBe(false);
    expect(isDuelFinished(WEEK, "2026-10-05")).toBe(true);
  });
});
