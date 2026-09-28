"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/env";
import { logServerError, type ActionResult } from "@/lib/errors";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";
import {
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  safeNextPath,
} from "@/lib/validation";

const TOO_MANY = "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";

async function limited(scope: string, identity: string, max: number, windowMs: number) {
  const ip = clientIp(await headers());
  return hitRateLimit(`${scope}:ip:${ip}`, max * 3, windowMs) || hitRateLimit(`${scope}:id:${identity}`, max, windowMs);
}

export type AuthFormState = ActionResult<"check-email" | "sent"> | null;

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: "Revisa los campos.", fieldErrors: fieldErrors(parsed.error) };
  if (await limited("login", parsed.data.email, 10, 15 * 60_000)) return { ok: false, error: TOO_MANY };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { ok: false, error: "Confirma tu email antes de entrar (revisa tu bandeja de entrada)." };
    }
    if (error.status === 429) return { ok: false, error: TOO_MANY };
    // Mensaje genérico: no revela si el email existe.
    return { ok: false, error: "Email o contraseña incorrectos." };
  }
  redirect(safeNextPath(formData.get("next") as string | null));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
    username: formData.get("username"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) return { ok: false, error: "Revisa los campos.", fieldErrors: fieldErrors(parsed.error) };
  if (await limited("signup", parsed.data.email, 5, 60 * 60_000)) return { ok: false, error: TOO_MANY };

  const supabase = await createClient();
  const { data: available } = await supabase.rpc("username_available", { p_username: parsed.data.username });
  if (available === false) {
    return { ok: false, error: "Revisa los campos.", fieldErrors: { username: "Ese nombre de usuario ya está cogido." } };
  }

  const next = safeNextPath(formData.get("next") as string | null, "/onboarding");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        username: parsed.data.username,
        display_name: parsed.data.displayName,
        timezone: parsed.data.timezone,
      },
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (error.status === 429) return { ok: false, error: TOO_MANY };
    if (error.code === "weak_password") {
      return { ok: false, error: "Contraseña demasiado débil.", fieldErrors: { password: "Elige una contraseña más robusta." } };
    }
    if (error.code === "user_already_exists") {
      return { ok: false, error: "No se ha podido crear la cuenta. Si ya tienes una, inicia sesión." };
    }
    logServerError("signUp", error);
    return { ok: false, error: "No se ha podido crear la cuenta. Inténtalo de nuevo." };
  }
  if (data.session) redirect(next);
  return { ok: true, data: "check-email" };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, error: "Revisa los campos.", fieldErrors: fieldErrors(parsed.error) };
  if (await limited("reset", parsed.data.email, 3, 60 * 60_000)) return { ok: false, error: TOO_MANY };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/reset-password`,
  });
  if (error && error.status !== 429) logServerError("resetPasswordForEmail", error);
  // Respuesta idéntica exista o no la cuenta (evita enumeración de emails).
  return { ok: true, data: "sent" };
}

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { ok: false, error: "Revisa los campos.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false, error: "El enlace ha caducado. Solicita uno nuevo." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { ok: false, error: "Revisa los campos.", fieldErrors: { password: "Debe ser distinta de la anterior." } };
    }
    logServerError("updatePassword", error);
    return { ok: false, error: "No se ha podido actualizar la contraseña." };
  }
  redirect("/today?password=updated");
}
