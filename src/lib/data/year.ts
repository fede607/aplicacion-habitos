import "server-only";
import type { ServerSupabase } from "../supabase/server";
import type { IsoDate } from "../dates";
import { buildYearPixels, type YearPixels } from "../year-pixels";
import { getDailyStats, toDayStats } from "./queries";

/** Píxeles del año en curso de una persona en su grupo activo. */
export async function getYearPixels(supabase: ServerSupabase, groupId: string, userId: string, today: IsoDate): Promise<YearPixels> {
  const year = Number(today.slice(0, 4));
  const rows = await getDailyStats(supabase, groupId, `${year}-01-01`, today, userId);
  return buildYearPixels(toDayStats(rows.filter((r) => r.user_id === userId)), year, today);
}
