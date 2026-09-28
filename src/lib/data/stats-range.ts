import { addDays, diffDays, type IsoDate } from "../dates";

const MAX_RANGE = 400;

/** Inicio efectivo de las estadísticas: arranque del arc (o hoy si aún no empezó). */
export function statsFrom(startDate: IsoDate, today: IsoDate): IsoDate {
  const from = startDate <= today ? startDate : today;
  return diffDays(today, from) > MAX_RANGE ? addDays(today, -MAX_RANGE) : from;
}
