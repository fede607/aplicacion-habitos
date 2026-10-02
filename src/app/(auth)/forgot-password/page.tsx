import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Recuperar contraseña" };

/** Year Arc no envía correos: la recuperación se hace a mano. */
export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">¿Has olvidado la contraseña?</h1>
        <p className="mt-2 text-sm text-muted">
          Escríbenos <ContactLine /> desde el email de tu cuenta y te ayudamos a recuperarla.
        </p>
      </div>
      <p className="text-center text-sm">
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Volver a entrar
        </Link>
      </p>
    </div>
  );
}
