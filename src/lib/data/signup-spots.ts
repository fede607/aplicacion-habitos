import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

export type SignupSpots = { total: number; left: number };

/**
 * Plazas de lanzamiento (límite real, aplicado en el alta). null = sin límite.
 * Cliente anónimo sin cookies para que la portada siga siendo cacheable.
 */
export async function getSignupSpots(): Promise<SignupSpots | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const sb = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await sb.rpc("signup_spots");
  const row = data?.[0];
  return row ? { total: row.total, left: row.spots_left } : null;
}
