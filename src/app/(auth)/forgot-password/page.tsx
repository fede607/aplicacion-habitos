import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine } from "@/components/legal/legal-page";
import { ResetWithCodeForm } from "@/components/recovery/reset-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

/** Recuperar la contraseña con la clave de recuperación (sin correos). */
export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Pon una contraseña nueva</h1>
        <p className="mt-1 text-sm text-muted">Con tu clave de recuperación, en un minuto y sin correos.</p>
      </div>
      <div className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <ResetWithCodeForm />
      </div>
      <p className="text-center text-xs text-muted">
        ¿No tienes la clave? Escríbenos <ContactLine /> desde el email de tu cuenta.
      </p>
      <p className="text-center text-sm">
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Volver a entrar
        </Link>
      </p>
    </div>
  );
}
