export const GOALS = ["fat_loss", "muscle", "strength", "endurance", "health"] as const;
export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const TRAINING_TYPES = ["gym", "home_dumbbells", "bodyweight", "running", "mixed"] as const;
export const LIMITATIONS = ["knee", "lower_back", "shoulder"] as const;
export const SEXES = ["male", "female"] as const;
export const SESSION_MINUTES = [30, 45, 60, 75, 90] as const;

export type Goal = (typeof GOALS)[number];
export type Level = (typeof LEVELS)[number];
export type TrainingType = (typeof TRAINING_TYPES)[number];
export type Limitation = (typeof LIMITATIONS)[number];
export type Sex = (typeof SEXES)[number];

export type TrainingProfile = {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  level: Level;
  trainingType: TrainingType;
  daysPerWeek: number; // 2..6
  sessionMinutes: number; // 30..90
  limitations: Limitation[];
};

export type PlannedExercise = {
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  /** Repeticiones en reserva: cuántas podrías hacer aún al acabar la serie. */
  rir: number;
  note?: string;
};

export type PlannedDay = {
  weekday: number; // 1 = lunes … 7 = domingo
  title: string;
  focus: string;
  warmup: string;
  exercises: PlannedExercise[];
  cardio?: string;
};

export type Nutrition = {
  bmr: number;
  maintenanceKcal: number;
  targetKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  waterL: number;
  bmi: number;
  note: string;
};

export type TrainingPlan = {
  title: string;
  summary: string;
  days: PlannedDay[];
  restDays: number[];
  nutrition: Nutrition;
  progression: string[];
  tips: string[];
  warnings: string[];
};
