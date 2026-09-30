import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Verificar email" };

export default async function VerifyNotificationEmailPage({ searchParams }: PageProps<"/notifications/verify">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const supabase = await createClient();
  const { data: ok } = await supabase.rpc("verify_notification_email", { p_token: token });
  return (
    <AuthShell>
      <div className="grid gap-4 rounded-3xl border border-border bg-surface p-6 text-center shadow-card">
        <p className="text-4xl" aria-hidden="true">
          {ok ? "📬" : "🧊"}
        </p>
        <h1 className="text-xl font-bold">{ok ? "Email verificado" : "Enlace no válido"}</h1>
        <p className="text-sm text-muted">
          {ok ? "Recibirás aquí las notificaciones del Year Arc." : "El enlace ha caducado o ya se ha usado. Solicita uno nuevo desde Ajustes."}
        </p>
        <Button asChild>
          <Link href="/settings">Ir a Ajustes</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
