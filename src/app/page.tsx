import type { Metadata } from "next";
import Link from "next/link";
import { Check, Dumbbell, Flame, ChartSpline, Medal, ShieldCheck, Smartphone, Users } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { PRO_MONTH_EUR, PRO_YEAR_EUR } from "@/lib/billing/paypal-me";
import { getPaymentsOpen } from "@/lib/billing/payments";
import { getPublicProof } from "@/lib/data/public-proof";
import { RatingSummary, ReviewCards, StatsStrip } from "@/components/reviews/social-proof";
import { LegalLinks } from "@/components/legal/legal-page";

// Opiniones y cifras reales: se refrescan cada 10 minutos.
export const revalidate = 600;

export const metadata: Metadata = { robots: { index: true, follow: true }, alternates: { canonical: "/" } };

const FEATURES = [
  { icon: ChartSpline, title: "Tu año en una línea", text: "Tu constancia día a día en un gráfico que sube contigo. Compártelo en tu estado." },
  { icon: Flame, title: "Tus hábitos, tus reglas", text: "Elige los tuyos en un toque o crea los que quieras." },
  { icon: Users, title: "Amigos (si quieres)", text: "Invita a tu gente para veros el progreso y animaros." },
  {
    icon: Dumbbell,
    title: "Plan a tu medida",
    text: "Rutina, series y calorías según tu cuerpo, objetivo y material.",
  },
  {
    icon: Medal,
    title: "Rango y progreso",
    text: "Sube de Bronce a Leyenda. Tus datos, mes a mes.",
  },
  {
    icon: ShieldCheck,
    title: "Privado de verdad",
    text: "Tus notas y datos físicos sólo los ves tú.",
  },
];

const STEPS = [
  ["Crea tu cuenta", "En 30 segundos."],
  ["Elige tus hábitos", "Los populares en un toque o los tuyos."],
  ["Mira tu línea subir", "Cada día cumplido, tu constancia sube."],
];

const FREE = ["Tus propios hábitos y racha", "Tu línea del año", "Grupo con tus amigos"];
const PRO = [
  "Todo lo gratis",
  "Plan de entreno personalizado",
  "Panel, rango, calendario y logros",
  "Estadísticas avanzadas y exportar",
  "Hasta 10 grupos · marco Pro",
];

function PhoneMock() {
  const habits = [
    ["🏋️", "Entrenar", true],
    ["📚", "Leer 20 páginas", true],
    ["💧", "2 L de agua", true],
    ["📵", "Sin móvil en la cama", false],
  ] as const;
  return (
    <div aria-hidden="true" className="relative mx-auto w-[17rem] rotate-2 rounded-[2.5rem] border-8 border-foreground/90 bg-background p-4 shadow-2xl">
      <div className="flex items-center gap-4 rounded-3xl bg-surface p-4 shadow-card">
        <div
          className="relative grid size-20 place-items-center rounded-full"
          style={{
            background: "conic-gradient(var(--primary) 0 75%, var(--surface-2) 75% 100%)",
          }}
        >
          <div className="grid size-16 place-items-center rounded-full bg-surface text-lg font-black">75%</div>
        </div>
        <div>
          <p className="text-xs text-muted">Racha</p>
          <p className="text-2xl font-black">🔥 23</p>
          <p className="text-xs text-muted">días seguidos</p>
        </div>
      </div>
      <ul className="mt-3 grid gap-2">
        {habits.map(([e, n, done]) => (
          <li key={n} className="flex items-center gap-3 rounded-2xl bg-surface p-3 text-sm shadow-card">
            <span>{e}</span>
            <span className="flex-1 font-medium">{n}</span>
            <span className={`grid size-7 place-items-center rounded-full ${done ? "bg-success text-white" : "border-2 border-border"}`}>
              {done ? <Check className="size-4" /> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ilustración (no son datos de nadie): una constancia que va subiendo. */
function LineDemo() {
  const values = [42, 48, 45, 55, 52, 60, 58, 66, 63, 70, 74, 71, 78, 82, 80, 86, 84, 90];
  const w = 300;
  const h = 140;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)} ${(h - (v / 100) * h).toFixed(1)}`);
  const line = `M${pts.join(" L")}`;
  return (
    <div aria-hidden="true" className="grid gap-2">
      <p className="text-4xl font-black tabular-nums">
        90% <span className="text-sm font-semibold text-success">▲ 48 pts</span>
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full overflow-visible" preserveAspectRatio="none">
        {[0, 50, 100].map((v) => (
          <line key={v} x1={0} x2={w} y1={h - (v / 100) * h} y2={h - (v / 100) * h} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="var(--primary)" opacity={0.1} />
        <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export default async function LandingPage() {
  const [{ reviews, stats }, PAYMENTS_OPEN] = await Promise.all([getPublicProof(), getPaymentsOpen()]);
  return (
    <div className="aurora min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Button asChild variant="ghost">
          <Link href="/login">Ya tengo cuenta</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <section className="grid items-center gap-12 pt-6 sm:pt-14 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-sm font-bold tracking-widest text-primary uppercase">Tu año · tus reglas · tu gente</p>
            <h1 className="mt-3 text-5xl font-black tracking-tight text-balance sm:text-6xl">Este año es para construirte.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted text-pretty">
              Tus hábitos, tu entreno y tu año pintado día a día. 365 días para convertirte en quien quieres ser.
            </p>
            <div className="mt-8 grid gap-3 sm:flex sm:items-center">
              <Button asChild size="xl" variant="pro" className="px-8">
                <Link href="/register">Empezar gratis</Link>
              </Button>
              <Link href="/instalar" className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-muted hover:text-foreground sm:px-4">
                <Smartphone className="size-4" aria-hidden="true" /> Instalar la app en el móvil
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted">1 mes de Pro gratis al empezar · sin tarjeta</p>
            <RatingSummary stats={stats} reviews={reviews} className="mt-5" />
            <StatsStrip stats={stats} className="mt-8 max-w-md" />
          </div>
          <PhoneMock />
        </section>

        {reviews.length ? (
          <section className="mt-20" aria-labelledby="opiniones">
            <h2 id="opiniones" className="text-center text-2xl font-black tracking-tight sm:text-3xl">
              Lo que dicen quienes ya lo usan
            </h2>
            <ReviewCards reviews={reviews} limit={3} className="mt-8 lg:grid-cols-3" />
            <p className="mt-5 text-center">
              <Link href="/opiniones" className="font-semibold text-primary hover:underline">
                Ver todas las opiniones →
              </Link>
            </p>
          </section>
        ) : null}

        <section className="mt-24 grid items-center gap-8 rounded-[2rem] bg-surface p-6 shadow-card sm:p-10 lg:grid-cols-2" aria-labelledby="linea">
          <div>
            <p className="text-sm font-bold tracking-widest text-primary uppercase">Sólo en Year Arc</p>
            <h2 id="linea" className="mt-2 text-3xl font-black tracking-tight text-balance">Tu año en una línea</h2>
            <p className="mt-3 text-muted text-pretty">
              Tu constancia día a día convertida en una línea. Cada día que cumples, sube. Ves al instante si vas mejorando y la compartes en tu estado en un toque.
            </p>
          </div>
          <LineDemo />
        </section>

        <section className="mt-24" aria-labelledby="como">
          <h2 id="como" className="text-center text-2xl font-black tracking-tight sm:text-3xl">
            Así de fácil
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="rounded-3xl border border-border bg-surface/80 p-5 shadow-card backdrop-blur">
                <span className="grid size-10 place-items-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">{i + 1}</span>
                <h3 className="mt-3 font-bold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-24" aria-labelledby="que">
          <h2 id="que" className="text-center text-2xl font-black tracking-tight sm:text-3xl">
            Todo lo que necesitas. Nada que sobre.
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl border border-border bg-surface/80 p-4 shadow-card backdrop-blur sm:p-5">
                <span className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 font-bold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>


        <section className="mt-24" aria-labelledby="precio">
          <h2 id="precio" className="text-center text-2xl font-black tracking-tight sm:text-3xl">
            Empieza gratis. Pro cuando quieras.
          </h2>
          <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-border bg-surface p-6">
              <p className="font-bold">Gratis</p>
              <p className="mt-1 text-4xl font-black">0 €</p>
              <ul className="mt-5 grid gap-2 text-sm">
                {FREE.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-success" aria-hidden="true" /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative rounded-3xl border-2 border-primary bg-surface p-6 shadow-card">
              <span className="pro-gradient absolute -top-3 right-5 rounded-full px-3 py-1 text-xs font-bold">{PAYMENTS_OPEN ? "1 mes gratis" : "Gratis"}</span>
              <p className="font-bold">Pro</p>
              {PAYMENTS_OPEN ? (
                <>
                  <p className="mt-1 text-4xl font-black">
                    {PRO_MONTH_EUR} €<span className="text-base font-semibold text-muted">/mes</span>
                  </p>
                  <p className="text-sm text-muted">o {PRO_YEAR_EUR} €/año (2 meses gratis)</p>
                </>
              ) : (
                <p className="mt-1 text-2xl font-black">Gratis por ahora</p>
              )}
              <ul className="mt-5 grid gap-2 text-sm">
                {PRO.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-24 rounded-[2rem] bg-surface p-8 text-center shadow-card sm:p-12">
          <h2 className="text-3xl font-black tracking-tight text-balance">¿Empiezas hoy o dentro de un año desearás haber empezado hoy?</h2>
          <Button asChild size="xl" variant="pro" className="mt-6 px-8">
            <Link href="/register">Empezar mi Year Arc</Link>
          </Button>
        </section>
      </main>
      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-6 text-xs text-muted sm:px-6">
        <p>© 2026 Year Arc</p>
        <LegalLinks />
      </footer>
    </div>
  );
}
