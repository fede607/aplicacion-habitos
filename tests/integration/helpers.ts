import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error(
    "Integration tests need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (local stack).",
  );
}

export type TestUser = {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
};

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function uniqueSuffix(): string {
  return randomBytes(4).toString("hex");
}

export async function createUser(name: string, timezone = "Europe/Madrid"): Promise<TestUser> {
  const suffix = uniqueSuffix();
  const email = `${name}.${suffix}@test.winterarc.local`;
  const password = `Pw-${randomBytes(8).toString("hex")}`;
  const client = anonClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { username: `${name}_${suffix}`.slice(0, 24), display_name: name, timezone } },
  });
  if (error || !data.user) throw error ?? new Error("signup failed");
  if (!data.session) {
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
  }
  return { id: data.user.id, email, password, client };
}

/** Fecha YYYY-MM-DD en una zona horaria. */
export function todayIn(timezone: string, offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
