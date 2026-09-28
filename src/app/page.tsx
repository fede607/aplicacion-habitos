import Link from "next/link";
import { CalendarDays, Flame, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Flame, title: "Rachas que enganchan", text: "Marca tus hábitos en segundos y mira cómo crece tu racha día a día." },
  { icon: Users, title: "Hecho en grupo", text: "Invita a tus amigos con un enlace. Progreso compartido, sin rankings tóxicos." },
  { icon: CalendarDays, title: "Todo tu histórico", text: "Calendario, entrenamientos, notas y estadísticas en cualquier dispositivo." },
  { icon: ShieldCheck, title: "Privado de verdad", text: "Tus notas son sólo tuyas. Tú decides qué ve el grupo." },
];

export default function LandingPage() {
  return (
    <div className="aurora min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Button asChild variant="ghost">
          <Link href="/login">Entrar</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-10 pb-20 sm:px-6 sm:pt-20">
        <section className="max-w-2xl">
          <p className="text-sm font-semibold tracking-widest text-primary uppercase">90 días · tus reglas · tu gente</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            El invierno es para construirte.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted text-pretty">
            Winter Arc es tu tracker de hábitos y entrenamiento para hacer el reto con tus amigos: entrena, estudia, lee y
            mejora cada día. Juntos es más fácil no fallar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">Empezar mi Winter Arc</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Ya tengo cuenta</Link>
            </Button>
          </div>
        </section>
        <section className="mt-20 grid gap-4 sm:grid-cols-2" aria-label="Qué incluye">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface/80 p-5 shadow-card backdrop-blur">
              <Icon className="size-6 text-primary" aria-hidden="true" />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
