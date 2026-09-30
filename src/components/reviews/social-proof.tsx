import { Star } from "lucide-react";
import type { PublicReview, PublicStats } from "@/lib/data/public-proof";
import { cn } from "@/lib/utils";

const fmt = (n: number) => new Intl.NumberFormat("es-ES").format(n);

/** Datos reales: sólo se muestra una cifra cuando ya es significativa. */
export function statItems(stats: PublicStats | null): { value: string; label: string }[] {
  if (!stats) return [];
  const items: { value: string; label: string }[] = [];
  if (stats.users >= 10) items.push({ value: fmt(stats.users), label: "personas haciendo su Year Arc" });
  if (stats.habits_done >= 50) items.push({ value: fmt(stats.habits_done), label: "hábitos cumplidos" });
  if (stats.habits_done_7d >= 20) items.push({ value: fmt(stats.habits_done_7d), label: "hábitos esta semana" });
  if (stats.workouts >= 20) items.push({ value: fmt(stats.workouts), label: "entrenos registrados" });
  if (stats.avg_rating !== null && stats.ratings >= 5) items.push({ value: `${String(stats.avg_rating).replace(".", ",")} ★`, label: `de ${stats.ratings} valoraciones` });
  return items.slice(0, 4);
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", i <= value ? "fill-amber-400 text-amber-400" : "text-border")} aria-hidden="true" />
      ))}
    </span>
  );
}

export function StatsStrip({ stats, className }: { stats: PublicStats | null; className?: string }) {
  const items = statItems(stats);
  if (!items.length) return null;
  return (
    <dl className={cn("grid gap-3", items.length >= 3 ? "grid-cols-3" : "grid-cols-2", className)}>
      {items.slice(0, items.length >= 3 ? 3 : 2).map((i) => (
        <div key={i.label} className="rounded-2xl bg-surface/80 p-3 text-center shadow-card backdrop-blur">
          <dt className="sr-only">{i.label}</dt>
          <dd className="tabular text-xl font-black sm:text-2xl">{i.value}</dd>
          <dd className="text-[11px] leading-tight text-muted">{i.label}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReviewCards({ reviews, limit = 6, className }: { reviews: PublicReview[]; limit?: number; className?: string }) {
  if (!reviews.length) return null;
  return (
    <ul className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {reviews.slice(0, limit).map((r) => (
        <li key={`${r.name}-${r.created_at}`} className="grid gap-2 rounded-3xl border border-border bg-surface/80 p-4 shadow-card backdrop-blur">
          <Stars value={r.rating} />
          <p className="text-sm text-pretty">“{r.body}”</p>
          <p className="flex items-center gap-2 text-xs font-semibold">
            <span className="grid size-6 place-items-center rounded-full text-[13px]" style={{ backgroundColor: r.avatar_color }} aria-hidden="true">
              {r.avatar_emoji ?? r.name.slice(0, 1).toUpperCase()}
            </span>
            {r.name} <span className="font-normal text-muted">· usuario de Year Arc</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
