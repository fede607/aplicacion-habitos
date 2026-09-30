import type { Metadata } from "next";
import Link from "next/link";
import { Maximize, RefreshCw, WifiOff, Zap } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { InstallAppCard } from "@/components/pwa/install-app";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Descarga la app",
  description: "Instala Year Arc en la pantalla de inicio de tu móvil, gratis y sin tienda de apps.",
};

const PERKS = [
  { icon: Zap, text: "Se abre al instante desde tu pantalla de inicio" },
  { icon: Maximize, text: "Pantalla completa, sin barra del navegador" },
  { icon: RefreshCw, text: "Siempre actualizada: nunca tienes que descargar nada más" },
  { icon: WifiOff, text: "Aviso claro si te quedas sin conexión" },
];

export default function InstallPage() {
  return (
    <div className="aurora min-h-dvh">
      <header className="mx-auto flex max-w-xl items-center justify-between px-4 py-5">
        <Link href="/" aria-label="Year Arc, inicio">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto grid max-w-xl gap-6 px-4 pb-16">
        <section className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- icono estático de la app */}
          <img src="/icons/icon-192.png" alt="" width={96} height={96} className="mx-auto size-24 rounded-[1.6rem] shadow-card" />
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-balance">Descarga Year Arc</h1>
          <p className="mt-2 text-muted text-pretty">Gratis, sin App Store ni Play Store. Tenla en tu pantalla de inicio en 10 segundos.</p>
        </section>

        <section className="rounded-3xl border border-border bg-surface/90 p-5 shadow-card backdrop-blur" aria-label="Cómo instalar">
          <InstallAppCard />
        </section>

        <ul className="grid gap-2 text-sm">
          {PERKS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 rounded-2xl bg-surface/70 px-4 py-3">
              <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" /> {text}
            </li>
          ))}
        </ul>

        <Button asChild size="lg" variant="outline" className="w-full">
          <Link href="/login">Entrar a mi cuenta</Link>
        </Button>
      </main>
    </div>
  );
}
