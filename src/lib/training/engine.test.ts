import { describe, expect, it } from "vitest";
import { computeNutrition, generatePlan } from "./engine";
import { isContraindicated } from "./library";
import { GOALS, LEVELS, LIMITATIONS, SESSION_MINUTES, TRAINING_TYPES, type Limitation, type TrainingProfile } from "./types";

const base: TrainingProfile = {
  age: 25,
  sex: "male",
  heightCm: 178,
  weightKg: 75,
  goal: "muscle",
  level: "intermediate",
  trainingType: "gym",
  daysPerWeek: 4,
  sessionMinutes: 60,
  limitations: [],
};

const limitationSets: Limitation[][] = [[], ["knee"], ["lower_back"], ["shoulder"], [...LIMITATIONS]];
const maxByMinutes: Record<number, number> = { 30: 4, 45: 5, 60: 6, 75: 7, 90: 8 };

describe("generatePlan — todas las combinaciones", () => {
  it("es coherente para cada objetivo, nivel, tipo, días, duración y lesión", () => {
    const errors: string[] = [];
    const check = (ok: boolean, msg: string) => {
      if (!ok && errors.length < 20) errors.push(msg);
    };
    let plans = 0;
    for (const goal of GOALS)
      for (const level of LEVELS)
        for (const trainingType of TRAINING_TYPES)
          for (let daysPerWeek = 2; daysPerWeek <= 6; daysPerWeek++)
            for (const sessionMinutes of SESSION_MINUTES)
              for (const limitations of limitationSets) {
                const p = { ...base, goal, level, trainingType, daysPerWeek, sessionMinutes, limitations };
                const id = JSON.stringify({ goal, level, trainingType, daysPerWeek, sessionMinutes, limitations });
                const plan = generatePlan(p);
                plans++;
                // Un día planificado por cada día de entreno, en días distintos.
                check(plan.days.length === daysPerWeek, `días ${id}`);
                check(new Set(plan.days.map((d) => d.weekday)).size === daysPerWeek, `días repetidos ${id}`);
                check(plan.restDays.length === 7 - daysPerWeek, `descansos ${id}`);
                for (const day of plan.days) {
                  check(day.exercises.length > 0 || !!day.cardio, `día vacío ${id}`);
                  check(day.exercises.length <= maxByMinutes[sessionMinutes], `demasiados ejercicios ${id}`);
                  const names = day.exercises.map((e) => e.name);
                  check(new Set(names).size === names.length, `ejercicio repetido ${id}`);
                  for (const ex of day.exercises) {
                    check(!isContraindicated(ex.name, limitations), `${ex.name} desaconsejado ${id}`);
                    check(ex.sets >= 2 && ex.sets <= 5, `series ${ex.sets} ${id}`);
                    check(ex.rir >= 1 && ex.rir <= 4, `rir ${ex.rir} ${id}`);
                    check(ex.restSec > 0, `descanso ${id}`);
                  }
                }
                check(/no sustituye/.test(plan.warnings.at(-1) ?? ""), `aviso final ${id}`);
              }
    expect(errors).toEqual([]);
    expect(plans).toBe(5 * 3 * 5 * 5 * 5 * 5);
  }, 30_000);

  it("es determinista", () => {
    expect(generatePlan(base)).toEqual(generatePlan(base));
  });

  it("los principiantes no hacen más de 4 días de fuerza", () => {
    const plan = generatePlan({ ...base, level: "beginner", daysPerWeek: 6 });
    expect(plan.days.filter((d) => d.exercises.length > 0)).toHaveLength(4);
    expect(plan.days.filter((d) => d.exercises.length === 0)).toHaveLength(2);
  });

  it("con lumbar delicada no hay peso muerto ni sentadilla con barra", () => {
    const plan = generatePlan({ ...base, level: "advanced", limitations: ["lower_back"] });
    const all = plan.days.flatMap((d) => d.exercises.map((e) => e.name)).join(" | ");
    expect(all).not.toMatch(/Peso muerto|Sentadilla trasera|Remo con barra/);
  });

  it("running alterna carrera y fuerza y avisa del 10%", () => {
    const plan = generatePlan({ ...base, trainingType: "running", goal: "endurance", daysPerWeek: 4 });
    expect(plan.days.filter((d) => d.exercises.length === 0).length).toBe(3);
    expect(plan.progression.join(" ")).toMatch(/10%/);
  });
});

describe("seguridad para menores y bajo peso", () => {
  it("un menor nunca recibe déficit ni rangos de 3-5", () => {
    const plan = generatePlan({ ...base, age: 16, goal: "fat_loss", weightKg: 80 });
    expect(plan.nutrition.targetKcal).toBe(plan.nutrition.maintenanceKcal);
    const strength = generatePlan({ ...base, age: 16, goal: "strength", level: "advanced" });
    expect(strength.days.flatMap((d) => d.exercises).some((e) => e.reps === "3-5")).toBe(false);
    expect(strength.warnings.join(" ")).toMatch(/menor/);
  });

  it("con IMC bajo no se plantea perder grasa", () => {
    const plan = generatePlan({ ...base, goal: "fat_loss", weightKg: 52, heightCm: 180 });
    expect(plan.nutrition.targetKcal).toBe(plan.nutrition.maintenanceKcal);
    expect(plan.warnings.join(" ")).toMatch(/bajo peso/);
  });
});

describe("computeNutrition", () => {
  it("Mifflin-St Jeor y macros cuadran", () => {
    const n = computeNutrition({ ...base, age: 30, weightKg: 80, heightCm: 180, sex: "male", daysPerWeek: 4 }, "health");
    // 10·80 + 6,25·180 − 5·30 + 5 = 1780
    expect(n.bmr).toBe(1780);
    expect(n.maintenanceKcal).toBe(Math.round((1780 * 1.55) / 50) * 50);
    const kcalFromMacros = n.proteinG * 4 + n.fatG * 9 + n.carbsG * 4;
    expect(Math.abs(kcalFromMacros - n.targetKcal)).toBeLessThan(80);
  });

  it("déficit del 20% para perder grasa en adultos y superávit del 10% para músculo", () => {
    const loss = computeNutrition({ ...base, age: 30 }, "fat_loss");
    const gain = computeNutrition({ ...base, age: 30 }, "muscle");
    expect(loss.targetKcal).toBeLessThan(loss.maintenanceKcal);
    expect(gain.targetKcal).toBeGreaterThan(gain.maintenanceKcal);
  });

  it("la proteína usa peso ajustado con obesidad", () => {
    const n = computeNutrition({ ...base, age: 30, weightKg: 130, heightCm: 175 }, "health");
    expect(n.proteinG).toBeLessThan(130 * 1.4);
  });
});
