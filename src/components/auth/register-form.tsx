"use client";

import { useActionState, useSyncExternalStore } from "react";
import { MailCheck } from "lucide-react";
import { signUp, type AuthFormState } from "@/app/actions/auth";
import { Field, Input } from "@/components/ui/input";
import { FormError, SubmitButton } from "./form-bits";

const noop = () => () => {};

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(signUp, null);
  const timezone = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "Europe/Madrid",
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok && state.data === "check-email") {
    return (
      <div className="grid justify-items-center gap-3 text-center" role="status">
        <MailCheck className="size-10 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Revisa tu correo</h2>
        <p className="text-sm text-muted">
          Te hemos enviado un enlace para confirmar tu cuenta. Ábrelo desde este dispositivo o cualquier otro.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="timezone" value={timezone} />
      <FormError message={state && !state.ok ? state.error : null} />
      <Field label="Nombre" htmlFor="displayName" error={errors?.displayName}>
        <Input id="displayName" name="displayName" autoComplete="name" maxLength={40} required aria-invalid={!!errors?.displayName} />
      </Field>
      <Field label="Nombre de usuario" htmlFor="username" error={errors?.username} hint="3-24 caracteres: minúsculas, números o _">
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={24}
          pattern="[a-z0-9_]{3,24}"
          required
          aria-invalid={!!errors?.username}
        />
      </Field>
      <Field label="Email" htmlFor="email" error={errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={!!errors?.email} />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={errors?.password} hint="Mínimo 8 caracteres, con letras y números">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required aria-invalid={!!errors?.password} />
      </Field>
      <SubmitButton pendingText="Creando cuenta…">Crear cuenta</SubmitButton>
    </form>
  );
}
