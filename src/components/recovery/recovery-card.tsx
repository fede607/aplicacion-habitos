"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, LoaderCircle } from "lucide-react";
import { createMyRecoveryCode } from "@/app/actions/recovery";
import { Button } from "@/components/ui/button";
import { CodeBox } from "./code-box";

/** Genera la clave de recuperación (en Hoy si aún no tiene, y en Perfil para regenerarla). */
export function RecoveryCard({ hasCode, banner = false }: { hasCode: boolean; banner?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState<string | null>(null);

  const generate = () =>
    start(async () => {
      if (hasCode && !window.confirm("Se creará una clave nueva y la anterior dejará de valer. ¿Seguir?")) return;
      const res = await createMyRecoveryCode();
      if (!res.ok) return void toast.error(res.error);
      setCode(res.data.code);
    });

  if (code) {
    return (
      <section className={banner ? "grid gap-3 rounded-3xl border border-primary/40 bg-surface p-5 shadow-card" : "grid gap-3"}>
        <h2 className="flex items-center gap-2 font-bold">
          <KeyRound className="size-5 text-primary" aria-hidden="true" /> Tu clave de recuperación
        </h2>
        <CodeBox code={code} />
        <Button
          onClick={() => {
            setCode(null);
            router.refresh();
          }}
        >
          Ya la he guardado
        </Button>
      </section>
    );
  }

  return (
    <section className={banner ? "grid gap-3 rounded-3xl border border-primary/40 bg-primary-soft p-4" : "grid gap-3"}>
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm">
          {hasCode ? (
            "Ya tienes una clave de recuperación. Si la has perdido, crea otra: la anterior dejará de valer."
          ) : (
            <>
              <b>Protege tu cuenta.</b> Crea tu clave de recuperación: si olvidas la contraseña, con ella pones una nueva en un minuto, sin correos.
            </>
          )}
        </p>
      </div>
      <Button variant={hasCode ? "outline" : "primary"} disabled={pending} onClick={generate} className="justify-self-start">
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
        {hasCode ? "Crear clave nueva" : "Crear mi clave"}
      </Button>
    </section>
  );
}
