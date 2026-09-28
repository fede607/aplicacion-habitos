import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Dumbbell, Plus } from "lucide-react";
import { requireSession } from "@/lib/data/session";
import { getWorkoutsPage, getWorkoutTotals } from "@/lib/data/queries";
import { formatLongDate, formatMinutes, startOfMonth } from "@/lib/dates";
import { WORKOUT_EMOJI, WORKOUT_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/ui/stat";

export const metadata: Metadata = { title: "Entrenamientos" };

export default async function WorkoutsPage({ searchParams }: PageProps<"/workouts">) {
  const { supabase, userId, today } = await requireSession();
  const params = await searchParams;
  const page = Math.max(0, Math.min(1000, Number.parseInt(typeof params.page === "string" ? params.page : "0", 10) || 0));

  const [{ items, hasMore }, month, total] = await Promise.all([
    getWorkoutsPage(supabase, userId, page),
    getWorkoutTotals(supabase, userId, startOfMonth(today), today),
    getWorkoutTotals(supabase, userId),
  ]);

  return (
    <div className="grid gap-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-ember uppercase">Entrenamiento</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tus sesiones</h1>
        </div>
        <Button asChild>
          <Link href="/workouts/new">
            <Plus aria-hidden="true" />
            Nuevo
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Este mes" icon={<Dumbbell />} tone="ember" value={month.count} />
        <Stat label="Tiempo este mes" icon={<Clock />} tone="ember" value={formatMinutes(month.minutes)} />
        <Stat label="Total" icon={<Dumbbell />} value={total.count} />
        <Stat label="Tiempo total" icon={<Clock />} value={formatMinutes(total.minutes)} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Dumbbell />}
          title={page === 0 ? "Aún no hay entrenamientos" : "No hay más entrenamientos"}
          description="Registra tipo, duración, sensación y qué quieres mejorar la próxima vez."
          action={
            <Button asChild>
              <Link href="/workouts/new">Registrar el primero</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {items.map((w) => (
            <li key={w.id}>
              <Link href={`/workouts/${w.id}`} className="block rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <span aria-hidden="true">{WORKOUT_EMOJI[w.type]}</span> {WORKOUT_LABELS[w.type]}
                    </p>
                    <p className="text-sm text-muted capitalize">{formatLongDate(w.workout_date)}</p>
                  </div>
                  <div className="tabular shrink-0 text-right text-sm">
                    <p className="font-semibold">{w.duration_min} min</p>
                    {w.feeling ? <p className="text-muted">Sensación {w.feeling}/10</p> : null}
                  </div>
                </div>
                {w.notes ? <p className="mt-2 line-clamp-2 text-sm break-words text-muted">{w.notes}</p> : null}
                {w.next_goal ? <p className="mt-1 text-sm break-words"><span className="font-medium text-primary">Próximo:</span> {w.next_goal}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Paginación" className="flex justify-between">
        {page > 0 ? (
          <Button asChild variant="outline">
            <Link href={`/workouts?page=${page - 1}`}>Más recientes</Link>
          </Button>
        ) : <span />}
        {hasMore ? (
          <Button asChild variant="outline">
            <Link href={`/workouts?page=${page + 1}`}>Anteriores</Link>
          </Button>
        ) : null}
      </nav>
    </div>
  );
}
