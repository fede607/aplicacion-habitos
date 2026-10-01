import "server-only";
import type { ServerSupabase } from "../supabase/server";
import type { IsoDate } from "../dates";
import { buildYearLine, type YearLine } from "../year-line";
import { getDailyStats, toDayStats } from "./queries";

/** Línea de constancia del año en curso de una persona en su grupo activo. */
export async function getYearLine(supabase: ServerSupabase, groupId: string, userId: string, today: IsoDate): Promise<YearLine> {
  const year = Number(today.slice(0, 4));
  const rows = await getDailyStats(supabase, groupId, `${year}-01-01`, today, userId);
  return buildYearLine(toDayStats(rows.filter((r) => r.user_id === userId)), year, today);
}
