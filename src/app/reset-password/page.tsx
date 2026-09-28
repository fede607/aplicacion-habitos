import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { requireSession } from "@/lib/data/session";
import { ResetPasswordForm } from "@/components/auth/reset-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function ResetPasswordPage() {
  await requireSession();
  return (
    <AuthShell>
      <div className="grid gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-muted">Elige una contraseña que no uses en otros sitios.</p>
        </div>
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <ResetPasswordForm />
        </div>
      </div>
    </AuthShell>
  );
}
