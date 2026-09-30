"use client";

import { useActionState } from "react";
import { updatePassword, type AuthFormState } from "@/app/actions/auth";
import { Field, Input } from "@/components/ui/input";
import { FormError, SubmitButton } from "./form-bits";

export function ResetPasswordForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(updatePassword, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={state && !state.ok ? state.error : null} />
      <Field label="Nueva contraseña" htmlFor="password" error={errors?.password} hint="Mínimo 8 caracteres, con letras y números">
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!errors?.password} />
      </Field>
      <Field label="Repite la contraseña" htmlFor="confirm" error={errors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required aria-invalid={!!errors?.confirm} />
      </Field>
      <SubmitButton pendingText="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
