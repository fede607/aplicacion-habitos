import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

/**
 * ¿Está abierta la venta de Pro? La controla el staff desde /pro/pagos.
 * Con la venta cerrada, Pro es gratis para todos y no se muestran precios.
 * Cliente anónimo sin cookies para que las páginas públicas sigan siendo cacheables.
 */
export const getPaymentsOpen = cache(async (): Promise<boolean> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  const sb = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await sb.rpc("payments_open");
  return data === true;
});
