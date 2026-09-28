"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { requestPasswordReset, type AuthFormState } from "@/app/actions/auth";
import { Field, Input } from "@/components/ui/input";
import { FormError, SubmitButton } from "./form-bits";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(requestPasswordReset, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  if (state?.ok) {
    return (
      <div className="grid justify-items-center gap-3 text-center" role="status">
        <MailCheck className="size-10 text-primary" aria-hidden="true" />
        <p className="text-sm text-muted">
          Si existe una cuenta con ese email, recibirás un enlace para restablecer la contraseña.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={state && !state.ok ? state.error : null} />
      <Field label="Email" htmlFor="email" error={errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={!!errors?.email} />
      </Field>
      <SubmitButton pendingText="Enviando…">Enviar enlace</SubmitButton>
    </form>
  );
}
