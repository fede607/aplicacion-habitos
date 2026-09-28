import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Cliente de navegador (sólo para Realtime; las escrituras van por server actions). */
export function getBrowserClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    );
  }
  return client;
}
