import "server-only";
import { diffDays, startOfIsoWeek, startOfMonth, type IsoDate } from "../dates";
import { computeStreaks, summarize, type DayStat, type Streaks, type Totals } from "../stats";
import { getDailyStats, toDayStats } from "./queries";
import { statsFrom } from "./stats-range";
import type { GroupSession } from "./session";

export type PersonalStats = {
  from: IsoDate;
  series: DayStat[];
  today: Totals;
  week: Totals;
  month: Totals;
  arc: Totals;
  streaks: Streaks;
  arcDay: number;
  arcLength: number;
  daysLeft: number;
  started: boolean;
};

export { statsFrom };

export async function getPersonalStats(session: GroupSession): Promise<PersonalStats> {
  const { supabase, userId, activeGroup, today } = session;
  const from = statsFrom(activeGroup.start_date, today);
  const rows = await getDailyStats(supabase, activeGroup.id, from, today, userId);
  const series = toDayStats(rows);
  const clamp = (d: IsoDate) => (d < from ? from : d);

  return {
    from,
    series,
    today: summarize(series, today, today),
    week: summarize(series, clamp(startOfIsoWeek(today)), today),
    month: summarize(series, clamp(startOfMonth(today)), today),
    arc: summarize(series, from, today),
    streaks: computeStreaks(series, activeGroup.streak_threshold, today),
    arcDay: Math.max(0, Math.min(diffDays(today, activeGroup.start_date) + 1, diffDays(activeGroup.end_date, activeGroup.start_date))),
    arcLength: diffDays(activeGroup.end_date, activeGroup.start_date),
    daysLeft: Math.max(0, diffDays(activeGroup.end_date, today)),
    started: activeGroup.start_date <= today,
  };
}
