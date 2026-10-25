import { addDays, diffDays, type IsoDate } from "../dates";

export const CHALLENGE_DAYS = [7, 21, 30] as const;
export type ChallengeDays = (typeof CHALLENGE_DAYS)[number];

/** Retos sugeridos (el usuario también puede escribir el suyo). */
export const CHALLENGE_TEMPLATES: { emoji: string; title: string }[] = [
  { emoji: "🍬", title: "Sin azúcar añadido" },
  { emoji: "👟", title: "10.000 pasos al día" },
  { emoji: "💧", title: "2 litros de agua" },
  { emoji: "📵", title: "Sin móvil después de las 23:00" },
  { emoji: "📚", title: "Leer 10 minutos" },
  { emoji: "🧘", title: "5 minutos de meditación" },
  { emoji: "💪", title: "50 flexiones" },
  { emoji: "🥗", title: "Verdura en cada comida" },
  { emoji: "🛏️", title: "Dormir 8 horas" },
  { emoji: "🚿", title: "Ducha fría" },
];

export type ChallengeProgress = {
  done: number;
  total: number;
  percent: number;
  /** Día del reto en el que estamos (1..total), o total si ya terminó el plazo. */
  dayNumber: number;
  lastDay: IsoDate;
  doneToday: boolean;
  doneYesterday: boolean;
  /** Se puede marcar ayer (está dentro del reto y no se marcó). */
  canMarkYesterday: boolean;
  /** El plazo terminó sin completarlo. */
  expired: boolean;
  /** Días seguidos cumplidos hasta hoy (o ayer si hoy aún no). */
  streak: number;
};

export function challengeProgress(
  c: { days: number; started_on: IsoDate; completed_at: string | null },
  checkins: Set<IsoDate>,
  today: IsoDate,
): ChallengeProgress {
  const lastDay = addDays(c.started_on, c.days - 1);
  const done = checkins.size;
  const yesterday = addDays(today, -1);
  const doneToday = checkins.has(today);
  const doneYesterday = checkins.has(yesterday);
  let streak = 0;
  for (let d = doneToday ? today : yesterday; d >= c.started_on && checkins.has(d); d = addDays(d, -1)) streak += 1;
  return {
    done,
    total: c.days,
    percent: Math.min(100, Math.round((done / c.days) * 100)),
    dayNumber: Math.min(c.days, Math.max(1, diffDays(today, c.started_on) + 1)),
    lastDay,
    doneToday,
    doneYesterday,
    canMarkYesterday: !doneYesterday && yesterday >= c.started_on && yesterday <= lastDay,
    expired: !c.completed_at && today > lastDay && done < c.days,
    streak,
  };
}
