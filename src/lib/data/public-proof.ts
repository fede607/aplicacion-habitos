import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

export type PublicReview = Database["public"]["Functions"]["public_reviews"]["Returns"][number];
export type PublicStats = Database["public"]["Functions"]["public_stats"]["Returns"][number];

/**
 * Opiniones aprobadas y estadísticas agregadas reales para la web pública.
 * Cliente anónimo sin cookies para que las páginas sigan siendo cacheables.
 */
export async function getPublicProof(): Promise<{ reviews: PublicReview[]; stats: PublicStats | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { reviews: [], stats: null };
  const sb = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [r, s] = await Promise.all([sb.rpc("public_reviews"), sb.rpc("public_stats")]);
  return { reviews: r.data ?? [], stats: s.data?.[0] ?? null };
}
