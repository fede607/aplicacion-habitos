"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { signUpErrorMessage } from "@/lib/auth-errors";
import { fieldErrors, registerSchema, safeNextPath } from "@/lib/validation";
import { Field, Input } from "@/components/ui/input";
import { FormError, SubmitButton } from "./form-bits";
import { Turnstile } from "./turnstile";
import { CAPTCHA_LOAD_ERROR, CAPTCHA_PENDING, useCaptcha } from "./use-captcha";

const noop = () => () => {};

/**
 * Registro sólo por invitación: `invite` llega del enlace /join/CODIGO. Sin
 * invitación sólo pueden registrarse la primera cuenta y los emails autorizados
 * (lo decide la base de datos, no este formulario).
 */
export function RegisterForm({ next, invite }: { next?: string; invite?: string }) {
  const router = useRouter();
  const timezone = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "Europe/Madrid",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checkEmail, setCheckEmail] = useState(false);
  const captcha = useCaptcha();

  if (checkEmail) {
    return (
      <div className="grid justify-items-center gap-3 text-center" role="status">
        <MailCheck className="size-10 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Revisa tu correo</h2>
        <p className="text-sm text-muted">
          Te hemos enviado un enlace para confirmar tu cuenta. Si no lo ves, mira en spam o promociones.
        </p>
      </div>
    );
  }

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
        if (!captcha.ready) {
          setError(CAPTCHA_PENDING);
          return;
        }
        setPending(true);
        setErrors({});
        setError(null);
        try {
          const supabase = getBrowserClient();
          const { data: available } = await supabase.rpc("username_available", { p_username: parsed.data.username });
          if (available === false) {
            setErrors({ username: "Ese nombre de usuario ya está cogido." });
            setError("Revisa los campos.");
            setPending(false);
            return;
          }
          // Con invitación, el alta ya mete a la persona en el grupo: directo a "Hoy".
          const target = invite ? "/today" : safeNextPath(next, "/onboarding");
          const { data, error: authError } = await supabase.auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
            options: {
              data: {
                username: parsed.data.username,
                display_name: parsed.data.displayName,
                timezone: parsed.data.timezone,
                ...(invite ? { invite_code: invite } : {}),
              },
              ...captcha.options,
              emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(target)}`,
            },
          });
          if (authError) {
            const msg = signUpErrorMessage(authError);
            setError(msg.form);
            if (msg.field) setErrors({ [msg.field[0]]: msg.field[1] });
            setPending(false);
            captcha.reset();
            return;
          }
          if (data.session) {
            router.replace(target);
            router.refresh();
          } else {
            setCheckEmail(true);
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
      <Turnstile onToken={captcha.setToken} resetSignal={captcha.resetSignal} onLoadError={captcha.onLoadError} />
      {captcha.loadError ? <FormError message={CAPTCHA_LOAD_ERROR} /> : null}
      <SubmitButton pending={pending} pendingText="Creando cuenta…">
        Crear cuenta
      </SubmitButton>
    </form>
  );
}
