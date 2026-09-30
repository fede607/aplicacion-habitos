import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Cliente + id de usuario verificado para server actions. */
export async function authed() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  return { supabase, userId };
}

export const NOT_AUTHENTICATED = {
  ok: false as const,
  error: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
};
