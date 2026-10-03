import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { LegalLinks } from "@/components/legal/legal-page";
import { getPublicProof } from "@/lib/data/public-proof";
import { ReviewCards, Stars } from "@/components/reviews/social-proof";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "Opiniones",
  description: "Lo que dicen las personas que usan Year Arc para sus hábitos y su entreno.",
  robots: { index: true, follow: true },
};

/** Todas las opiniones reales aprobadas, con la nota media. */
export default async function ReviewsPage() {
  const { reviews, stats } = await getPublicProof();
  const hasAvg = stats?.avg_rating !== null && stats?.avg_rating !== undefined && (stats?.ratings ?? 0) >= 3;
  return (
    <div className="aurora min-h-dvh">
      <main className="mx-auto grid max-w-4xl gap-8 px-4 py-8 sm:px-6">
        <Link href="/" aria-label="Year Arc, inicio">
          <Logo />
        </Link>
        <header className="grid gap-3 text-center">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Opiniones de Year Arc</h1>
          {hasAvg ? (
            <p className="flex items-center justify-center gap-2 text-lg">
              <Stars value={Math.round(Number(stats!.avg_rating))} className="[&_svg]:size-5" />
              <b>{String(stats!.avg_rating).replace(".", ",")}</b>
              <span className="text-muted">de 5 · {stats!.ratings} valoraciones</span>
            </p>
          ) : null}
          <p className="text-sm text-muted">Opiniones reales de usuarios, publicadas con su permiso.</p>
        </header>
        {reviews.length ? (
          <ReviewCards reviews={reviews} limit={50} className="lg:grid-cols-3" />
        ) : (
          <p className="rounded-3xl bg-surface p-6 text-center text-muted shadow-card">Todavía no hay opiniones publicadas. ¡Sé de los primeros!</p>
        )}
        <section className="grid justify-items-center gap-3 rounded-[2rem] bg-surface p-8 text-center shadow-card">
          <h2 className="text-2xl font-black tracking-tight">Empieza tu Year Arc</h2>
          <p className="text-muted">Gratis, con 1 mes de Pro.</p>
          <Button asChild size="xl" variant="pro" className="px-8">
            <Link href="/register">Empezar gratis</Link>
          </Button>
        </section>
        <LegalLinks className="text-center text-xs text-muted" />
      </main>
    </div>
  );
}
