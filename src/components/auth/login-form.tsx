"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/app/actions/auth";
import { Field, Input } from "@/components/ui/input";
import { FormError, SubmitButton } from "./form-bits";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(signIn, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormError message={state && !state.ok ? state.error : null} />
      <Field label="Email" htmlFor="email" error={errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={!!errors?.email} />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!errors?.password} />
      </Field>
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          ¿Has olvidado la contraseña?
        </Link>
      </div>
      <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
    </form>
  );
}
