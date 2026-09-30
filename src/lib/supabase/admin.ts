import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

/**
 * Cliente con service role. SÓLO para el cron de notificaciones y la creación de
 * verificaciones de email. Nunca se importa desde componentes de cliente
 * (`server-only` lo impide en build) y la clave no lleva prefijo NEXT_PUBLIC_.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY (sólo servidor) para las notificaciones.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY);
}
