import { pickExercise, type Equipment, type Pattern } from "./library";
import type { CyclePhase, Focus, Goal, Level, Limitation, Nutrition, PlannedDay, PlannedExercise, TrainingPlan, TrainingProfile } from "./types";

/**
 * Generador de planes de entrenamiento. Puro y determinista: el mismo perfil
 * siempre da el mismo plan (se puede testear y no depende de ninguna IA).
 *
 * Base: recomendaciones generales de fuerza (ACSM/NSCA) — patrones básicos,
 * 10-20 series por grupo muscular y semana, RIR 1-3, doble progresión y
 * descarga cada 4 semanas — y Mifflin-St Jeor para el gasto energético.
 */

export const GOAL_LABELS: Record<Goal, string> = {
  fat_loss: "Perder grasa",
  recomp: "Definir (perder grasa y ganar músculo)",
  muscle: "Ganar músculo",
  strength: "Ganar fuerza",
  endurance: "Resistencia",
  health: "Salud y forma general",
};
export const FOCUS_LABELS: Record<Focus, string> = {
  balanced: "Equilibrado",
  glutes_legs: "Glúteo y piernas",
  chest_arms: "Pecho y brazos",
  back_posture: "Espalda y postura",
  shoulders: "Hombros",
  core: "Abdomen y core",
};
export const LIMITATION_LABELS: Record<Limitation, string> = {
  knee: "Rodilla",
  lower_back: "Zona lumbar",
  shoulder: "Hombro",
  wrist: "Muñeca",
  hip: "Cadera",
  ankle: "Tobillo",
};
const FOCUS_PATTERNS: Record<Focus, Pattern[]> = {
  balanced: [],
  glutes_legs: ["hinge", "lunge"],
  chest_arms: ["hpush", "triceps", "biceps"],
  back_posture: ["hpull", "vpull"],
  shoulders: ["vpush", "lateral"],
  core: ["core"],
};
export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

const WEEKDAY_SLOTS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

type DayTemplate = { title: string; focus: string; patterns: Pattern[] };

const T = {
  fullA: {
    title: "Cuerpo completo A",
    focus: "piernas, pecho y espalda",
    patterns: ["squat", "hpush", "hpull", "hinge", "core", "biceps", "calves", "lateral"],
  },
  fullB: {
    title: "Cuerpo completo B",
    focus: "cadera, hombros y espalda",
    patterns: ["hinge", "vpush", "vpull", "lunge", "core", "triceps", "lateral", "calves"],
  },
  fullC: {
    title: "Cuerpo completo C",
    focus: "piernas, pecho y dorsales",
    patterns: ["squat", "hpush", "vpull", "lunge", "core", "lateral", "biceps", "triceps"],
  },
  upper: {
    title: "Torso",
    focus: "pecho, espalda y hombros",
    patterns: ["hpush", "hpull", "vpush", "vpull", "lateral", "biceps", "triceps", "core"],
  },
  lower: {
    title: "Pierna",
    focus: "cuádriceps, glúteo e isquios",
    patterns: ["squat", "hinge", "lunge", "calves", "core", "lateral"],
  },
  upperB: {
    title: "Torso B",
    focus: "hombros, espalda y pecho",
    patterns: ["vpush", "vpull", "hpush", "hpull", "triceps", "biceps", "lateral", "core"],
  },
  lowerB: {
    title: "Pierna B",
    focus: "glúteo, isquios y cuádriceps",
    patterns: ["hinge", "squat", "lunge", "core", "calves", "biceps"],
  },
  push: {
    title: "Empuje",
    focus: "pecho, hombros y tríceps",
    patterns: ["hpush", "vpush", "lateral", "triceps", "core", "calves"],
  },
  pull: {
    title: "Tirón",
    focus: "espalda y bíceps",
    patterns: ["vpull", "hpull", "biceps", "lateral", "core", "calves"],
  },
  legs: {
    title: "Pierna",
    focus: "cuádriceps, glúteo e isquios",
    patterns: ["squat", "hinge", "lunge", "calves", "core", "biceps"],
  },
} satisfies Record<string, DayTemplate>;

function strengthSplit(days: number): DayTemplate[] {
  switch (days) {
    case 1:
      return [T.fullA];
    case 2:
      return [T.fullA, T.fullB];
    case 3:
      return [T.fullA, T.fullB, T.fullC];
    case 4:
      return [T.upper, T.lower, T.upperB, T.lowerB];
    case 5:
      return [T.upper, T.lower, T.push, T.pull, T.legs];
    default:
      return [T.push, T.pull, T.legs, T.push, T.pull, T.legs];
  }
}

const EXERCISES_BY_MINUTES: Record<number, number> = {
  30: 4,
  45: 5,
  60: 6,
  75: 7,
  90: 8,
};

type Dose = { sets: number; reps: string; restSec: number; rir: number };

function dose(goal: Goal, main: boolean, level: Level, minor: boolean): Dose {
  const table: Record<Goal, { main: Dose; acc: Dose }> = {
    strength: {
      main: { sets: 4, reps: "3-5", restSec: 180, rir: 2 },
      acc: { sets: 3, reps: "6-8", restSec: 120, rir: 2 },
    },
    muscle: {
      main: { sets: 4, reps: "6-10", restSec: 120, rir: 2 },
      acc: { sets: 3, reps: "10-15", restSec: 75, rir: 1 },
    },
    fat_loss: {
      main: { sets: 3, reps: "8-12", restSec: 90, rir: 2 },
      acc: { sets: 3, reps: "12-15", restSec: 60, rir: 2 },
    },
    recomp: {
      main: { sets: 4, reps: "6-10", restSec: 120, rir: 2 },
      acc: { sets: 3, reps: "10-15", restSec: 60, rir: 2 },
    },
    endurance: {
      main: { sets: 3, reps: "12-15", restSec: 60, rir: 3 },
      acc: { sets: 2, reps: "15-20", restSec: 45, rir: 2 },
    },
    health: {
      main: { sets: 3, reps: "8-12", restSec: 90, rir: 3 },
      acc: { sets: 2, reps: "10-15", restSec: 60, rir: 3 },
    },
  };
  const d = { ...(main ? table[goal].main : table[goal].acc) };
  if (level === "beginner") {
    d.sets = Math.max(2, d.sets - 1);
    d.rir = Math.min(4, d.rir + 1);
  } else if (level === "advanced" && main && (goal === "muscle" || goal === "strength")) {
    d.sets = Math.min(5, d.sets + 1);
  }
  // Menores: nada de rangos casi máximos; técnica y reserva siempre.
  if (minor) {
    if (d.reps === "3-5") d.reps = "5-8";
    d.rir = Math.max(2, d.rir);
  }
  return d;
}

function timedReps(level: Level): string {
  return level === "beginner" ? "20-30 s" : level === "intermediate" ? "30-45 s" : "45-60 s";
}

/** Pone los patrones de la zona prioritaria justo tras los dos principales (no se recortan por tiempo). */
function withFocus(patterns: Pattern[], focus: Focus): Pattern[] {
  const extra = FOCUS_PATTERNS[focus];
  if (!extra.length) return patterns;
  const rest = patterns.filter((x) => !extra.includes(x));
  return [...rest.slice(0, 2), ...extra, ...rest.slice(2)];
}

/** Minutos estimados: ~40 s por serie + descansos + 8 min de calentamiento. */
export function estimateMinutes(exercises: PlannedExercise[], cardio?: string): number {
  const work = exercises.reduce((acc, e) => acc + e.sets * (40 + e.restSec), 0) / 60;
  const cardioMin = cardio ? Number(/(\d+)(?:-(\d+))? min/.exec(cardio)?.[2] ?? /(\d+)(?:-(\d+))? min/.exec(cardio)?.[1] ?? 0) : 0;
  return Math.max(15, Math.round((8 + work + cardioMin) / 5) * 5);
}

function buildStrengthDay(tpl: DayTemplate, weekday: number, p: TrainingProfile, equipment: Equipment, maxExercises: number, minor: boolean): PlannedDay {
  const focusPatterns = FOCUS_PATTERNS[p.focus ?? "balanced"];
  const seen = new Set<string>();
  const exercises: PlannedExercise[] = [];
  for (const pattern of withFocus(tpl.patterns, p.focus ?? "balanced")) {
    if (exercises.length >= maxExercises) break;
    const ex = pickExercise(pattern, equipment, p.level, p.limitations);
    if (seen.has(ex.name)) continue; // p. ej. el mismo remo como sustituto de dos patrones
    seen.add(ex.name);
    const main = exercises.length < 2 && !["core", "calves", "biceps", "triceps", "lateral"].includes(pattern);
    const d = dose(p.goal, main, p.level, minor);
    const isFocus = focusPatterns.includes(pattern);
    exercises.push({
      name: ex.name,
      sets: isFocus ? Math.min(5, d.sets + 1) : d.sets,
      reps: ex.timed ? timedReps(p.level) : d.reps,
      restSec: ex.timed ? Math.min(d.restSec, 60) : d.restSec,
      rir: d.rir,
      muscles: ex.muscles,
      alternatives: ex.alternatives,
      ...(ex.cue ? { cue: ex.cue } : {}),
      ...(ex.note ? { note: ex.note } : {}),
      ...(isFocus ? { focus: true } : {}),
    });
  }
  const cardio = finisher(p.goal, p.level);
  return {
    weekday,
    title: tpl.title,
    focus: tpl.focus,
    warmup: `5 min de cardio suave + movilidad de ${tpl.focus} + 2 series ligeras del primer ejercicio.`,
    exercises,
    cardio,
    estMinutes: Math.min(p.sessionMinutes + 15, estimateMinutes(exercises, cardio)),
  };
}

function finisher(goal: Goal, level: Level): string | undefined {
  if (goal === "fat_loss" || goal === "recomp")
    return level === "beginner"
      ? "Al acabar: 15-20 min de caminata rápida o bici suave."
      : "Al acabar: 20-30 min de cardio en zona 2 (puedes hablar con frases cortas).";
  if (goal === "endurance") return "Al acabar: 10 min de intervalos — 5 × (1 min fuerte / 1 min suave).";
  if (goal === "health") return "Al acabar: 10-15 min de caminata rápida.";
  return undefined;
}

function runningDays(p: TrainingProfile, slots: number[], equipment: Equipment, maxExercises: number, minor: boolean): PlannedDay[] {
  const lvl = p.level;
  const easy =
    lvl === "beginner"
      ? "Caminar-correr: 8 × (1 min trotando / 2 min andando). Cada semana, +30 s de trote."
      : lvl === "intermediate"
        ? "Rodaje de 30-40 min en zona 2 (puedes hablar)."
        : "Rodaje de 45-60 min en zona 2.";
  const intervals =
    lvl === "beginner"
      ? "Tras 10 min suaves: 6 × (1 min rápido / 2 min andando). 5 min de vuelta a la calma."
      : lvl === "intermediate"
        ? "Tras 10 min suaves: 5 × (3 min a ritmo de 5 km / 2 min suave). 10 min suaves."
        : "Tras 15 min suaves: 6 × (4 min a ritmo de 10 km / 2 min suave). 10 min suaves.";
  const long =
    lvl === "beginner"
      ? "Tirada larga: 35-40 min alternando trote y caminata."
      : lvl === "intermediate"
        ? "Tirada larga: 50-60 min muy suave."
        : "Tirada larga: 70-90 min muy suave.";
  const recovery = "Regenerativo: 20-30 min muy suave o 40 min andando.";
  const run = (weekday: number, title: string, text: string): PlannedDay => ({
    weekday,
    title,
    focus: "carrera",
    warmup: "5 min andando rápido + movilidad de tobillo y cadera + 3 aceleraciones suaves.",
    exercises: [],
    cardio: text,
    estMinutes: estimateMinutes([], text),
  });
  const runStrength = {
    ...T.fullA,
    title: "Fuerza para corredores",
    patterns: ["squat", "hinge", "lunge", "calves", "core", "hpull"] as Pattern[],
  };
  const runStrengthB = {
    ...T.fullB,
    title: "Fuerza para corredores B",
    patterns: ["lunge", "hinge", "hpush", "calves", "core", "vpull"] as Pattern[],
  };
  const s = (weekday: number, tpl: DayTemplate) => buildStrengthDay(tpl, weekday, { ...p, goal: "endurance" }, equipment, Math.min(maxExercises, 5), minor);
  const byCount: Record<number, ((d: number) => PlannedDay)[]> = {
    2: [(d) => run(d, "Rodaje", easy), (d) => s(d, runStrength)],
    3: [(d) => run(d, "Rodaje", easy), (d) => s(d, runStrength), (d) => run(d, "Tirada larga", long)],
    4: [(d) => run(d, "Rodaje", easy), (d) => s(d, runStrength), (d) => run(d, "Series", intervals), (d) => run(d, "Tirada larga", long)],
    5: [
      (d) => run(d, "Rodaje", easy),
      (d) => s(d, runStrength),
      (d) => run(d, "Series", intervals),
      (d) => s(d, runStrengthB),
      (d) => run(d, "Tirada larga", long),
    ],
    6: [
      (d) => run(d, "Rodaje", easy),
      (d) => s(d, runStrength),
      (d) => run(d, "Series", intervals),
      (d) => run(d, "Regenerativo", recovery),
      (d) => s(d, runStrengthB),
      (d) => run(d, "Tirada larga", long),
    ],
  };
  return byCount[slots.length].map((make, i) => make(slots[i]));
}

function conditioningDay(weekday: number, p: TrainingProfile): PlannedDay {
  const knee = p.limitations.includes("knee");
  const circuit = knee
    ? "Circuito 4 rondas, 40 s trabajo / 20 s descanso: bici o elíptica, remo con toalla, puente de glúteo, dead bug, plancha lateral."
    : "Circuito 4 rondas, 40 s trabajo / 20 s descanso: sentadilla a caja, flexiones inclinadas, remo con toalla, zancadas atrás, plancha.";
  return {
    weekday,
    title: "Condición física",
    focus: "corazón y resistencia",
    warmup: "5 min de cardio suave + movilidad general.",
    exercises: [],
    cardio: circuit,
    estMinutes: 30,
  };
}

function recoveryDay(weekday: number): PlannedDay {
  return {
    weekday,
    title: "Cardio suave y movilidad",
    focus: "recuperación activa",
    warmup: "Empieza muy suave.",
    exercises: [],
    cardio: "30-40 min de caminata rápida, bici o natación suave + 10 min de estiramientos.",
    estMinutes: 50,
  };
}

export function computeNutrition(p: TrainingProfile, goal: Goal): Nutrition {
  const minor = p.age < 18;
  const h = p.heightCm / 100;
  const bmi = p.weightKg / (h * h);
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "male" ? 5 : -161);
  const activity = p.daysPerWeek <= 2 ? 1.375 : p.daysPerWeek <= 4 ? 1.55 : 1.725;
  const maintenance = bmr * activity;
  let target = maintenance;
  let note: string;
  if (minor) {
    note =
      "Estás en edad de crecimiento: come a tu gasto (sin dietas de déficit) y prioriza comida real, fruta, verdura y proteína en cada comida. Para cambiar tu peso, habla antes con tu médico.";
  } else if (goal === "fat_loss") {
    target = maintenance * 0.8;
    note = "Déficit moderado (~20%): perderás ~0,5-1% de tu peso por semana sin perder músculo. No bajes de estas calorías.";
  } else if (goal === "recomp") {
    target = maintenance * 0.9;
    note = "Déficit suave (~10%) con mucha proteína: bajas grasa despacio mientras ganas músculo. Mira la cinta métrica y las fotos, no sólo la báscula.";
  } else if (goal === "muscle") {
    target = maintenance * 1.1;
    note = "Superávit ligero (~10%): gana 0,25-0,5% de peso por semana. Si subes más rápido, reduce 150 kcal.";
  } else {
    note = "Calorías de mantenimiento: tu peso debería mantenerse estable. Ajusta ±150 kcal si cambia más de 1 kg en 2 semanas.";
  }
  // Proteína sobre peso ajustado si hay obesidad (evita cifras disparadas).
  const proteinWeight = bmi > 30 ? 25 * h * h : p.weightKg;
  const perKg = minor ? 1.5 : goal === "fat_loss" || goal === "recomp" ? 2.0 : goal === "muscle" || goal === "strength" ? 1.8 : 1.4;
  const proteinG = Math.round(proteinWeight * perKg);
  const fatG = Math.round(Math.max(0.6 * p.weightKg, (target * 0.25) / 9));
  const carbsG = Math.max(0, Math.round((target - proteinG * 4 - fatG * 9) / 4));
  const round50 = (n: number) => Math.round(n / 50) * 50;
  return {
    bmr: Math.round(bmr),
    maintenanceKcal: round50(maintenance),
    targetKcal: round50(target),
    proteinG,
    fatG,
    carbsG,
    waterL: Math.round(p.weightKg * 0.035 * 10) / 10,
    bmi: Math.round(bmi * 10) / 10,
    note,
  };
}

export function equipmentFor(type: TrainingProfile["trainingType"]): Equipment {
  return type === "gym" || type === "mixed" ? "gym" : type === "home_dumbbells" ? "dumbbells" : "bodyweight";
}

/** Días de entreno: los que elija la persona si cuadran; si no, un reparto con descansos intercalados. */
export function pickSlots(daysPerWeek: number, preferred?: number[]): number[] {
  const clean = [...new Set((preferred ?? []).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b);
  return clean.length === daysPerWeek ? clean : WEEKDAY_SLOTS[daysPerWeek];
}

/** Semana del ciclo de 4 (3 de progresión + 1 de descarga) contada desde que se generó el plan. */
export function cyclePhase(startIso: string, todayIso: string): CyclePhase {
  const days = Math.max(0, Math.floor((Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${startIso.slice(0, 10)}T00:00:00Z`)) / 86_400_000));
  const week = ((Math.floor(days / 7) % 4) + 1) as CyclePhase["week"];
  const phases: Record<CyclePhase["week"], Omit<CyclePhase, "week">> = {
    1: {
      label: "Semana 1 · Base",
      tip: "Pesos cómodos: apunta cuánto mueves en cada ejercicio.",
      deload: false,
    },
    2: {
      label: "Semana 2 · Progresa",
      tip: "Intenta 1 repetición más o un poco más de peso que la semana pasada.",
      deload: false,
    },
    3: {
      label: "Semana 3 · Aprieta",
      tip: "Semana más dura: acércate al RIR indicado en todas las series.",
      deload: false,
    },
    4: {
      label: "Semana 4 · Descarga",
      tip: "Mitad de series con el mismo peso: tu cuerpo asimila el trabajo y vuelves más fuerte.",
      deload: true,
    },
  };
  return { week, ...phases[week] };
}

/** En la semana de descarga se hace la mitad de series (mínimo 1). */
export function applyPhase(day: PlannedDay, phase: CyclePhase): PlannedDay {
  if (!phase.deload) return day;
  return {
    ...day,
    exercises: day.exercises.map((e) => ({
      ...e,
      sets: Math.max(1, Math.ceil(e.sets / 2)),
    })),
  };
}

export function generatePlan(input: TrainingProfile): TrainingPlan {
  const p: TrainingProfile = {
    ...input,
    daysPerWeek: Math.min(6, Math.max(2, Math.round(input.daysPerWeek))),
    sessionMinutes: [30, 45, 60, 75, 90].includes(input.sessionMinutes) ? input.sessionMinutes : 60,
    focus: input.focus ?? "balanced",
  };
  const minor = p.age < 18;
  const warnings: string[] = [];
  const bmi = p.weightKg / (p.heightCm / 100) ** 2;

  // Objetivo efectivo: nunca perder grasa con bajo peso.
  let goal = p.goal;
  if ((goal === "fat_loss" || goal === "recomp") && bmi < 18.5) {
    goal = "health";
    warnings.push(
      "Tu IMC indica bajo peso: no es recomendable buscar perder grasa. El plan se centra en salud y fuerza; si te preocupa tu peso, consúltalo con tu médico.",
    );
  }
  if (bmi >= 30 && p.trainingType === "running" && p.level === "beginner") {
    warnings.push("Para cuidar tus articulaciones, empieza caminando rápido y alternando con bici o elíptica; introduce el trote poco a poco.");
  }
  if (p.limitations.length) {
    warnings.push(
      "Hemos quitado los ejercicios que suelen molestar con tus lesiones. Si algo te produce dolor agudo (no cansancio), para y consulta con un fisioterapeuta.",
    );
  }
  if (p.limitations.includes("ankle") && p.trainingType === "running") {
    warnings.push(
      "Con molestias de tobillo, empieza en superficies blandas y regulares (tierra, pista) y fortalece gemelos y tobillo antes de subir kilómetros.",
    );
  }
  if (minor) {
    warnings.push("Eres menor de edad: aprende la técnica con pesos cómodos, pide supervisión la primera vez con pesos libres y no hagas máximos (1RM).");
  }

  const pg: TrainingProfile = { ...p, goal };
  const equipment = equipmentFor(p.trainingType);
  const maxExercises = EXERCISES_BY_MINUTES[p.sessionMinutes] ?? 6;
  const slots = pickSlots(p.daysPerWeek, p.preferredDays);

  let days: PlannedDay[];
  if (p.trainingType === "running") {
    days = runningDays(pg, slots, "bodyweight", maxExercises, minor);
  } else {
    // Principiantes: máximo 4 días de fuerza; el resto, recuperación activa.
    const strengthDays = p.trainingType === "mixed" ? Math.min(4, p.daysPerWeek - 1) : p.level === "beginner" ? Math.min(4, p.daysPerWeek) : p.daysPerWeek;
    const split = strengthSplit(strengthDays);
    days = slots.map((weekday, i) => {
      if (i < split.length) return buildStrengthDay(split[i], weekday, pg, equipment, maxExercises, minor);
      return p.trainingType === "mixed" ? conditioningDay(weekday, pg) : recoveryDay(weekday);
    });
  }

  const restDays = [1, 2, 3, 4, 5, 6, 7].filter((d) => !slots.includes(d));
  const typeLabel: Record<TrainingProfile["trainingType"], string> = {
    gym: "Gimnasio",
    home_dumbbells: "En casa con mancuernas",
    bodyweight: "Peso corporal",
    running: "Running",
    mixed: "Gimnasio + condición física",
  };

  const progression = [
    "Doble progresión: cuando hagas todas las series en lo más alto del rango dejando las RIR indicadas, sube el peso un 2,5-5% (o pasa a una variante más difícil) y vuelve a lo bajo del rango.",
    "Semanas 1-3: intenta sumar 1 repetición o un poco de peso cada semana. Semana 4: descarga, haz la mitad de series con el mismo peso.",
    "RIR = repeticiones en reserva: RIR 2 significa que acabas la serie pudiendo hacer 2 más con buena técnica.",
    "Apunta cada sesión en Entrenos y actualiza tu peso cada 4 semanas para recalcular el plan.",
  ];
  if (p.level === "beginner") progression.unshift("Las 2 primeras semanas son de técnica: pesos cómodos y movimientos controlados.");
  if (p.trainingType === "running") {
    progression.push("No aumentes tu volumen de carrera más de un 10% por semana.");
  }

  const tips = [
    "Duerme 8-9 horas si eres menor, 7-9 si eres adulto: es cuando se recupera el músculo.",
    "Camina 8.000-10.000 pasos al día además de entrenar.",
    goal === "fat_loss"
      ? "Llena medio plato de verdura y un cuarto de proteína en cada comida: sacia más con menos calorías."
      : "Reparte la proteína en 3-4 comidas (unos 20-40 g en cada una).",
  ];
  if (goal === "muscle" || goal === "strength")
    tips.push("Añade 1-2 sesiones de 20 min de cardio suave a la semana: mejora la recuperación sin quitarte músculo.");

  if (p.focus && p.focus !== "balanced") {
    tips.unshift(`Prioridad ${FOCUS_LABELS[p.focus].toLowerCase()}: esos ejercicios van al principio (con más energía) y llevan una serie extra.`);
  }

  const summary = `${GOAL_LABELS[goal]} · ${typeLabel[p.trainingType]} · ${p.daysPerWeek} días/semana · ${p.sessionMinutes} min · nivel ${LEVEL_LABELS[p.level].toLowerCase()}`;
  const title =
    p.trainingType === "running"
      ? "Plan de carrera + fuerza"
      : `Plan ${days
          .filter((d) => d.exercises.length)
          .map((d) => d.title.split(" ")[0])
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(" / ")}`;

  warnings.push(
    "Plan orientativo generado a partir de tus datos: no sustituye a un médico, nutricionista o entrenador. Si tienes alguna condición médica, consúltalo antes de empezar.",
  );

  return {
    title,
    summary,
    days,
    restDays,
    nutrition: computeNutrition(pg, goal),
    progression,
    tips,
    warnings,
  };
}
