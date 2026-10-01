"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import { fieldErrors, registerSchema, safeNextPath } from "@/lib/validation";
import { Field, Input } from "@/components/ui/input";
import { FormError, SubmitButton } from "./form-bits";
import { Turnstile } from "./turnstile";
import { CAPTCHA_LOAD_ERROR, CAPTCHA_PENDING, useCaptcha } from "./use-captcha";

const noop = () => () => {};

/**
 * Registro abierto (con invitación opcional). Usa la Edge Function `register-user`
 * para crear la cuenta con email ya confirmado y devolver la sesión.
 */
export function RegisterForm({ next, invite, source }: { next?: string; invite?: string; source?: string }) {
  const router = useRouter();
  const timezone = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "Europe/Madrid",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const captcha = useCaptcha();
  const [accepted, setAccepted] = useState(false);

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const parsed = registerSchema.safeParse({
          email: form.get("email"),
          password: form.get("password"),
          displayName: form.get("displayName"),
          username: form.get("username"),
          timezone,
        });
        if (!parsed.success) {
          setErrors(fieldErrors(parsed.error));
          setError("Revisa los campos.");
          return;
        }
        if (!accepted) {
          setError("Para continuar, confirma que tienes 14 años o más y aceptas los términos.");
          return;
        }
        if (!captcha.ready) {
          setError(CAPTCHA_PENDING);
          return;
        }
        setPending(true);
        setErrors({});
        setError(null);

        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const anonKey =
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

          const resp = await fetch(`${supabaseUrl}/functions/v1/register-user`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
            },
            body: JSON.stringify({
              email: parsed.data.email,
              password: parsed.data.password,
              username: parsed.data.username,
              displayName: parsed.data.displayName,
              timezone: parsed.data.timezone,
              inviteCode: invite,
              source,
              acceptTerms: true,
              captchaToken: captcha.token ?? undefined,
            }),
          });

          const result = (await resp.json()) as {
            created?: boolean;
            fallback?: boolean;
            access_token?: string;
            refresh_token?: string;
            error?: string;
            field?: string;
          };

          if (!resp.ok || result.error) {
            if (result.field === "username") {
              setErrors({ username: "Ese nombre de usuario ya está cogido." });
            }
            setError(result.error ?? "No se ha podido crear la cuenta. Inténtalo de nuevo.");
            setPending(false);
            captcha.reset();
            return;
          }

          if (result.fallback) {
            // Cuenta creada pero no se pudo obtener sesión automáticamente
            router.replace(
              `/login?message=${encodeURIComponent("Cuenta creada. Inicia sesión para entrar.")}&email=${encodeURIComponent(parsed.data.email)}`,
            );
            return;
          }

          if (result.access_token && result.refresh_token) {
            const supabase = getBrowserClient();
            await supabase.auth.setSession({
              access_token: result.access_token,
              refresh_token: result.refresh_token,
            });
            const target = invite ? "/today" : safeNextPath(next, "/onboarding");
            router.replace(target);
            router.refresh();
          }
        } catch {
          setError("Sin conexión. Inténtalo de nuevo.");
          setPending(false);
        }
      }}
    >
      <FormError message={error} />
      <Field label="Nombre" htmlFor="displayName" error={errors.displayName}>
        <Input id="displayName" name="displayName" autoComplete="name" maxLength={40} required aria-invalid={!!errors.displayName} />
      </Field>
      <Field label="Nombre de usuario" htmlFor="username" error={errors.username} hint="3-24 caracteres: minúsculas, números o _">
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={24}
          required
          aria-invalid={!!errors.username}
        />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={!!errors.email} />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={errors.password} hint="Mínimo 8 caracteres, con letras y números">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required aria-invalid={!!errors.password} />
      </Field>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
        <span>
          Tengo 14 años o más y acepto los{" "}
          <a href="/terminos" target="_blank" className="font-medium text-primary underline">
            términos
          </a>{" "}
          y la{" "}
          <a href="/privacidad" target="_blank" className="font-medium text-primary underline">
            política de privacidad
          </a>
          .
        </span>
      </label>
      <Turnstile onToken={captcha.setToken} resetSignal={captcha.resetSignal} onLoadError={captcha.onLoadError} />
      {captcha.loadError ? <FormError message={CAPTCHA_LOAD_ERROR} /> : null}
      <SubmitButton pending={pending} pendingText="Creando cuenta…">
        Crear cuenta
      </SubmitButton>
    </form>
  );
}
