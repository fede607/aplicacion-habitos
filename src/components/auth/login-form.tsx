"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import { signInErrorMessage } from "@/lib/auth-errors";
import { fieldErrors, loginSchema, safeNextPath } from "@/lib/validation";
import { Field, Input } from "@/components/ui/input";
import { FormError, SubmitButton } from "./form-bits";

/**
 * El login se hace desde el navegador: así los límites anti-fuerza-bruta de
 * Supabase Auth se aplican por la IP de cada persona y no a la IP compartida del
 * servidor. La sesión queda en cookies que el servidor valida en cada petición.
 */
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
        if (!parsed.success) {
          setErrors(fieldErrors(parsed.error));
          setError("Revisa los campos.");
          return;
        }
        setPending(true);
        setErrors({});
        try {
          const { error: authError } = await getBrowserClient().auth.signInWithPassword(parsed.data);
          if (authError) {
            setError(signInErrorMessage(authError));
            setPending(false);
            return;
          }
          router.replace(safeNextPath(next));
          router.refresh();
        } catch {
          setError("Sin conexión. Inténtalo de nuevo.");
          setPending(false);
        }
      }}
    >
      <FormError message={error} />
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={!!errors.email} />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={errors.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!errors.password} />
      </Field>
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          ¿Has olvidado la contraseña?
        </Link>
      </div>
      <SubmitButton pending={pending} pendingText="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}
