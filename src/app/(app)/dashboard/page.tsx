import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, ChevronRight, Clock, Dumbbell, Flame, Target, TrendingUp } from "lucide-react";
import { requireFullAccess } from "@/lib/data/session";
import { getPersonalStats } from "@/lib/data/personal-stats";
import { getMemberRank, persistRankSnapshots } from "@/lib/data/rank";
import { PHASE_LABELS } from "@/lib/rank/engine";
import { getTier } from "@/lib/rank/tiers";
import { RankEmblem } from "@/components/rank/rank-emblem";
import { getActiveHabits, getMyLogs, getWorkoutTotals, indexLogs } from "@/lib/data/queries";
import { addDays, eachDay, formatMinutes, formatShortDate, startOfIsoWeek } from "@/lib/dates";
import { weeklyTargetProgress } from "@/lib/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { Stat } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";
import { HabitIcon } from "@/components/habits/habit-icon";
import { RecentDaysChart } from "@/components/stats/recent-days-chart";

export const metadata: Metadata = { title: "Panel" };

export default async function DashboardPage() {
  const session = await requireFullAccess();
  const { supabase, userId, activeGroup, today } = session;
  const weekStart = startOfIsoWeek(today);

  const [stats, workouts, habits, weekLogs, notesRes, rank] = await Promise.all([
    getPersonalStats(session),
    getWorkoutTotals(supabase, userId, activeGroup.start_date <= today ? activeGroup.start_date : undefined, today),
    getActiveHabits(supabase, activeGroup.id),
    getMyLogs(supabase, userId, activeGroup.id, weekStart, today),
    supabase
      .from("daily_entries")
      .select("entry_date, improve_tomorrow")
      .eq("user_id", userId)
      .neq("improve_tomorrow", "")
      .order("entry_date", { ascending: false })
      .limit(5),
    getMemberRank(supabase, {
      group: activeGroup,
      memberId: userId,
      joinedAt: activeGroup.joined_at,
      timeZone: session.profile.timezone,
      today,
    }),
  ]);
  await persistRankSnapshots(supabase, userId, activeGroup.id, rank.result, today);
  const g = rank.result.global;

  const logIndex = indexLogs(weekLogs);
  const weeklyHabits = habits.filter((h) => h.frequency === "weekly_target");
  const statByDay = new Map(stats.series.map((s) => [s.day, s]));
  const last14 = eachDay(addDays(today, -13), today).map(
    (day) => statByDay.get(day) ?? { day, required: 0, completed: 0, skipped: 0, bonus: 0 },
  );

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">{activeGroup.name}</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tu panel</h1>
        </div>
        <ArcBadge started={stats.started} arcDay={stats.arcDay} arcLength={stats.arcLength} daysLeft={stats.daysLeft} startDate={activeGroup.start_date} />
      </header>

      <section className="grid gap-4 lg:grid-cols-[18rem_1fr]" aria-label="Resumen">
        <Card className="aurora flex flex-col items-center justify-center gap-3 p-6">
          <ProgressRing value={stats.today.percent ?? 0} size={148} label={`Progreso de hoy ${stats.today.percent ?? 0}%`}>
            <div className="text-center">
              <div className="tabular text-4xl font-bold tracking-tight">{stats.today.percent ?? 0}%</div>
              <div className="text-xs text-muted">hoy</div>
            </div>
          </ProgressRing>
          <p className="tabular text-sm text-muted">
            {stats.today.completed} / {stats.today.required} hábitos del día
          </p>
          <Button asChild size="sm" variant="secondary">
            <Link href="/today">Ir a hoy</Link>
          </Button>
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
          <Stat
            label="Esta semana"
            icon={<CalendarCheck />}
            tone="primary"
            value={
              <>
                {stats.week.completed} <span className="text-lg text-muted">/ {stats.week.required}</span>
              </>
            }
            sub={stats.week.percent === null ? "Sin hábitos aún" : `${stats.week.percent}% cumplido`}
          />
          <Stat label="Este mes" icon={<TrendingUp />} tone="primary" value={stats.month.percent === null ? "—" : `${stats.month.percent}%`} sub={`${stats.month.completed} de ${stats.month.required} hábitos`} />
          <Stat
            label="Racha actual"
            icon={<Flame />}
            tone="ember"
            value={`${stats.streaks.current} ${stats.streaks.current === 1 ? "día" : "días"}`}
            sub={`Mejor: ${stats.streaks.best} · objetivo ≥ ${activeGroup.streak_threshold}%`}
          />
          <Stat label="Entrenamientos" icon={<Dumbbell />} tone="ember" value={workouts.count} sub="en este Winter Arc" />
          <Stat label="Tiempo entrenando" icon={<Clock />} tone="ember" value={formatMinutes(workouts.minutes)} />
          <Stat label="Total del arc" icon={<Target />} tone="success" value={stats.arc.percent === null ? "—" : `${stats.arc.percent}%`} sub={`${stats.arc.activeDays} días activos`} />
        </div>
      </section>

      <Link
        href="/rank"
        className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2"
      >
        <RankEmblem tierIndex={g.tierIndex} size={56} />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs font-semibold tracking-widest text-muted uppercase">Tu rango</span>
            <span className="text-lg font-black tracking-tight uppercase">{g.tierIndex === null ? "Sin rango aún" : getTier(g.tierIndex).name}</span>
            {g.tierIndex !== null && g.phase !== "stable" ? <span className="text-xs text-muted">{PHASE_LABELS[g.phase].toLowerCase()}</span> : null}
          </div>
          <ProgressBar value={g.progress} label="Progreso hacia el siguiente rango" />
          <span className="tabular text-xs text-muted">
            {g.score === null
              ? "Completa tu primer día para desbloquearlo"
              : `${g.score.toLocaleString("es-ES", { maximumFractionDigits: 1 })} / 100${g.next ? ` · +${g.next.pointsNeeded.toLocaleString("es-ES", { maximumFractionDigits: 1 })} para ${g.next.name}` : ""}`}
          </span>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos 14 días</CardTitle>
            <Link href="/calendar" className="text-sm font-medium text-primary hover:underline">
              Calendario
            </Link>
          </CardHeader>
          <CardContent>
            <RecentDaysChart days={last14} threshold={activeGroup.streak_threshold} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Objetivos semanales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {weeklyHabits.length === 0 ? (
              <p className="text-sm text-muted">Este grupo no tiene hábitos con objetivo semanal.</p>
            ) : (
              weeklyHabits.map((h) => {
                const p = weeklyTargetProgress(logIndex.get(h.id) ?? new Map(), weekStart, h.weekly_target ?? 1);
                return (
                  <div key={h.id} className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <HabitIcon name={h.icon} className="size-4 shrink-0 text-muted" />
                        <span className="truncate">{h.name}</span>
                      </span>
                      <span className="tabular shrink-0 text-muted">
                        {p.done}/{p.target}
                      </span>
                    </div>
                    <ProgressBar value={p.percent} tone={p.done >= p.target ? "success" : "primary"} label={`${h.name}: ${p.done} de ${p.target}`} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Área de mejora</CardTitle>
          <span className="text-xs text-muted">🔒 Sólo tú lo ves</span>
        </CardHeader>
        <CardContent>
          {(notesRes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">
              Cuando escribas «¿Qué puedo mejorar mañana?» en tus notas diarias, aparecerá aquí.
            </p>
          ) : (
            <ul className="grid gap-3">
              {notesRes.data!.map((n) => (
                <li key={n.entry_date} className="rounded-xl bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-muted">{formatShortDate(n.entry_date)}</p>
                  <p className="mt-1 text-sm whitespace-pre-line break-words">{n.improve_tomorrow}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ArcBadge({
  started,
  arcDay,
  arcLength,
  daysLeft,
  startDate,
}: {
  started: boolean;
  arcDay: number;
  arcLength: number;
  daysLeft: number;
  startDate: string;
}) {
  if (!started) {
    return <p className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary">Empieza el {formatShortDate(startDate)}</p>;
  }
  return (
    <div className="grid min-w-48 gap-1.5">
      <p className="tabular text-right text-sm font-semibold">
        Día {arcDay} de {arcLength} <span className="font-normal text-muted">· quedan {daysLeft}</span>
      </p>
      <ProgressBar value={(arcDay / Math.max(arcLength, 1)) * 100} tone="ember" label="Progreso del Winter Arc" />
    </div>
  );
}
