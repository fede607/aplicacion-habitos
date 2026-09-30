import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Recuperar contraseña
        </h1>
        <p className="mt-1 text-sm text-muted">
          Te enviaremos un enlace seguro por email.
        </p>
      </div>
      <div className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <ForgotPasswordForm />
      </div>
      <p className="text-center text-sm">
        <Link
          href="/login"
          className="font-semibold text-primary hover:underline"
        >
          Volver a entrar
        </Link>
      </p>
    </div>
  );
}
