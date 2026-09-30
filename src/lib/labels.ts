import type {
  HabitCategory,
  HabitFrequency,
  WorkoutType,
} from "./database.types";
import { WEEKDAY_NAMES } from "./dates";

export const CATEGORY_LABELS: Record<HabitCategory, string> = {
  physical: "Físico",
  mental: "Mental",
  productivity: "Productividad / aprendizaje",
  health: "Salud",
  other: "Otros",
};

export const FREQUENCY_LABELS: Record<HabitFrequency, string> = {
  daily: "Todos los días",
  weekdays: "Días concretos",
  weekly_target: "Objetivo semanal",
};

export const WORKOUT_LABELS: Record<WorkoutType, string> = {
  gym: "Gimnasio",
  boxing: "Deporte",
  cardio: "Cardio",
  mobility: "Movilidad",
  other: "Otro",
};

export const WORKOUT_EMOJI: Record<WorkoutType, string> = {
  gym: "🏋️",
  boxing: "⚽",
  cardio: "🏃",
  mobility: "🧘",
  other: "⚡",
};

export function describeFrequency(h: {
  frequency: HabitFrequency;
  weekdays: number[];
  weekly_target: number | null;
  is_optional?: boolean;
}): string {
  let text: string;
  if (h.frequency === "daily") text = "Diario";
  else if (h.frequency === "weekly_target")
    text = `${h.weekly_target ?? 1}× por semana`;
  else if (
    h.weekdays.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => h.weekdays.includes(d))
  )
    text = "Lunes a viernes";
  else
    text = h.weekdays.map((d) => WEEKDAY_NAMES[d - 1]?.slice(0, 3)).join(" · ");
  return h.is_optional ? `${text} · opcional` : text;
}
