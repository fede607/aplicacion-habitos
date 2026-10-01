import Link from "next/link";
import { Logo } from "@/components/layout/logo";

/** Responsable y contacto. El email se configura con NEXT_PUBLIC_CONTACT_EMAIL. */
export const LEGAL_OWNER = "Pablo Palomeque";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
export const LEGAL_UPDATED = "1 de octubre de 2026";

export function ContactLine() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary underline">
      {CONTACT_EMAIL}
    </a>
  ) : (
    <span>desde la app, en Perfil › Valorar Year Arc</span>
  );
}

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-8 text-sm leading-relaxed [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-1">
      <Link href="/" aria-label="Year Arc, inicio">
        <Logo />
      </Link>
      <header>
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        <p className="text-muted">Última actualización: {LEGAL_UPDATED}</p>
      </header>
      {children}
      <footer className="border-t border-border pt-4 text-xs text-muted">
        <Link href="/privacidad" className="underline">
          Privacidad
        </Link>{" "}
        ·{" "}
        <Link href="/terminos" className="underline">
          Términos
        </Link>{" "}
        · <Link href="/">Year Arc</Link>
      </footer>
    </main>
  );
}

export function LegalLinks({ className }: { className?: string }) {
  return (
    <p className={className}>
      <Link href="/privacidad" className="underline">
        Privacidad
      </Link>{" "}
      ·{" "}
      <Link href="/terminos" className="underline">
        Términos
      </Link>
    </p>
  );
}
