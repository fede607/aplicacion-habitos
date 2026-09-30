"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { TOO_MANY } from "@/lib/auth-errors";
import { forgotPasswordSchema } from "@/lib/validation";
import { Field, Input } from "@/components/ui/input";
import { FormError, SubmitButton } from "./form-bits";
import { Turnstile } from "./turnstile";
import { CAPTCHA_LOAD_ERROR, CAPTCHA_PENDING, useCaptcha } from "./use-captcha";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const captcha = useCaptcha();

  if (sent) {
    return (
      <div className="grid justify-items-center gap-3 text-center" role="status">
        <MailCheck className="size-10 text-primary" aria-hidden="true" />
        <p className="text-sm text-muted">
          Si existe una cuenta con ese email, recibirás un enlace para restablecer la contraseña. Ábrelo en este mismo
          navegador.
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
        const parsed = forgotPasswordSchema.safeParse({ email: new FormData(e.currentTarget).get("email") });
        if (!parsed.success) {
          setFieldError("Email no válido");
          return;
        }
        if (!captcha.ready) {
          setError(CAPTCHA_PENDING);
          return;
        }
        setPending(true);
        setFieldError(undefined);
        try {
          const { error: authError } = await getBrowserClient().auth.resetPasswordForEmail(parsed.data.email, {
            redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
            ...captcha.options,
          });
          if (authError?.status === 429 || authError?.code === "captcha_failed") {
            setError(authError.status === 429 ? TOO_MANY : CAPTCHA_PENDING);
            setPending(false);
            captcha.reset();
            return;
          }
          // Misma respuesta exista o no la cuenta (evita enumeración de emails).
          setSent(true);
        } catch {
          setError("Sin conexión. Inténtalo de nuevo.");
          setPending(false);
        }
      }}
    >
      <FormError message={error} />
      <Field label="Email" htmlFor="email" error={fieldError}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={!!fieldError} />
      </Field>
      <Turnstile onToken={captcha.setToken} resetSignal={captcha.resetSignal} onLoadError={captcha.onLoadError} />
      {captcha.loadError ? <FormError message={CAPTCHA_LOAD_ERROR} /> : null}
      <SubmitButton pending={pending} pendingText="Enviando…">
        Enviar enlace
      </SubmitButton>
    </form>
  );
}
