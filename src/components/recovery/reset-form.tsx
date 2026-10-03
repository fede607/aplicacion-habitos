"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { resetPasswordWithCode } from "@/app/actions/recovery";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { CodeBox } from "./code-box";

/** Recuperar la contraseña con usuario/email + clave de recuperación. */
export function ResetWithCodeForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<{ code: string; emailedTo: string | null } | null>(null);

  if (newCode) {
    return (
      <div className="grid gap-4">
        <p className="flex items-center gap-2 font-semibold text-success">
          <CircleCheck className="size-5" aria-hidden="true" /> Contraseña cambiada
        </p>
        <p className="text-sm">Tu clave anterior ya no vale. Esta es la nueva: guárdala antes de seguir.</p>
        <CodeBox code={newCode.code} emailedTo={newCode.emailedTo} />
        <Button asChild>
          <Link href="/login">Ya la he guardado · Iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const password = String(f.get("password") ?? "");
        if (password !== String(f.get("password2") ?? "")) return setError("Las contraseñas no coinciden.");
        setError(null);
        start(async () => {
          const res = await resetPasswordWithCode({ login: String(f.get("login") ?? ""), code: String(f.get("code") ?? ""), password });
          if (res.ok) setNewCode({ code: res.data.newCode, emailedTo: res.data.emailedTo });
          else setError(res.error);
        });
      }}
    >
      {error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Field label="Usuario o email" htmlFor="login">
        <Input id="login" name="login" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </Field>
      <Field label="Clave de recuperación" htmlFor="code" hint="16 letras y números, p. ej. ABCD-EFGH-JKLM-NPQR">
        <Input id="code" name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} required className="font-mono uppercase tracking-wider" />
      </Field>
      <Field label="Contraseña nueva" htmlFor="password" hint="Mínimo 8 caracteres, con letras y números">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>
      <Field label="Repite la contraseña" htmlFor="password2">
        <Input id="password2" name="password2" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null} Cambiar contraseña
      </Button>
    </form>
  );
}
