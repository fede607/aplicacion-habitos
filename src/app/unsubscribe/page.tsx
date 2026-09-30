import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { uuidSchema } from "@/lib/validation";
import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata: Metadata = { title: "Darse de baja" };

/** Página con botón (no se da de baja en el GET para que los antivirus de correo no lo activen). */
export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const params = await searchParams;
  const token = uuidSchema.safeParse(params.token);
  return (
    <AuthShell>
      <div className="grid gap-4 rounded-3xl border border-border bg-surface p-6 text-center shadow-card">
        <h1 className="text-xl font-bold">Emails del Year Arc</h1>
        {token.success ? (
          <>
            <p className="text-sm text-muted">Dejarás de recibir el recordatorio diario y el resumen semanal. Puedes reactivarlos en Ajustes.</p>
            <UnsubscribeButton token={token.data} />
          </>
        ) : (
          <>
            <p className="text-sm text-muted">El enlace no es válido.</p>
            <Button asChild variant="secondary">
              <Link href="/settings">Ir a Ajustes</Link>
            </Button>
          </>
        )}
      </div>
    </AuthShell>
  );
}
