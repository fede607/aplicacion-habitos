import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Check, Minus, X } from "lucide-react";
import { requireGroup } from "@/lib/data/session";
import { getActiveHabits, getDailyStats, toDayStats } from "@/lib/data/queries";
import {
  addMonths,
  endOfMonth,
  formatLongDate,
  formatMonth,
  isIsoDate,
  isMonthString,
  monthGrid,
  WEEKDAY_LABELS,
} from "@/lib/dates";
import { dayLevel, dayPercent, isScheduledOn, type DayLevel } from "@/lib/stats";
import { WORKOUT_EMOJI, WORKOUT_LABELS } from "@/lib/labels";
import type { HabitLogStatus } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HabitIcon } from "@/components/habits/habit-icon";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendario" };

const LEVEL_STYLE: Record<DayLevel, string> = {
  complete: "bg-success text-white dark:text-background",
  partial: "bg-warning/80 text-white dark:text-background",
  low: "bg-danger/80 text-white dark:text-background",
  rest: "bg-surface-2 text-foreground ring-1 ring-inset ring-primary/40",
  none: "bg-surface-2 text-muted",
  future: "bg-transparent text-muted/60",
};

const LEVEL_LABEL: Record<DayLevel, string> = {
  complete: "Día cumplido",
  partial: "Parcial",
  low: "Poco cumplimiento",
  rest: "Descanso",
  none: "Sin datos",
  future: "Futuro",
};

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { supabase, userId, activeGroup, today } = await requireGroup();
  const params = await searchParams;
  const month = typeof params.month === "string" && isMonthString(params.month) ? params.month : today.slice(0, 7);
  const selected = typeof params.day === "string" && isIsoDate(params.day) && params.day <= today ? params.day : null;

  const monthStart = `${month}-01`;
  const monthEnd = endOfMonth(monthStart);
  const statsTo = monthEnd < today ? monthEnd : today;
  const threshold = activeGroup.streak_threshold;

  const [rows, habits, detail] = await Promise.all([
    monthStart <= today ? getDailyStats(supabase, activeGroup.id, monthStart, statsTo, userId) : Promise.resolve([]),
    getActiveHabits(supabase, activeGroup.id),
    selected
      ? Promise.all([
          supabase.from("habit_logs").select("habit_id, status").eq("user_id", userId).eq("group_id", activeGroup.id).eq("log_date", selected),
          supabase.from("workouts").select("id, type, duration_min, feeling, notes").eq("user_id", userId).eq("workout_date", selected).order("created_at"),
          supabase.from("daily_entries").select("did_today, improve_tomorrow").eq("user_id", userId).eq("entry_date", selected).maybeSingle(),
        ])
      : Promise.resolve(null),
  ]);

  const stats = new Map(toDayStats(rows).map((s) => [s.day, s]));
  const weeks = monthGrid(month);
  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const canNext = `${nextMonth}-01` <= today;

  return (
    <div className="grid gap-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Calendario</p>
          <h1 className="text-2xl font-bold tracking-tight first-letter:uppercase sm:text-3xl">{formatMonth(month)}</h1>
        </div>
        <nav aria-label="Cambiar de mes" className="flex gap-1">
          <Link href={`/calendar?month=${prevMonth}`} aria-label="Mes anterior" className="grid size-10 place-items-center rounded-xl border border-border bg-surface hover:bg-surface-2">
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
          {canNext ? (
            <Link href={`/calendar?month=${nextMonth}`} aria-label="Mes siguiente" className="grid size-10 place-items-center rounded-xl border border-border bg-surface hover:bg-surface-2">
              <ChevronRight className="size-5" aria-hidden="true" />
            </Link>
          ) : (
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl border border-border opacity-40">
              <ChevronRight className="size-5" />
            </span>
          )}
        </nav>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="p-3 sm:p-5">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="grid" aria-label={`Calendario de ${formatMonth(month)}`}>
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} role="columnheader" className="pb-1 text-center text-xs font-semibold text-muted">
                {d}
              </div>
            ))}
            {weeks.flat().map((day, i) => {
              if (!day) return <div key={`empty-${i}`} role="gridcell" aria-hidden="true" />;
              const stat = stats.get(day);
              const level = dayLevel(stat, threshold, day, today);
              const pct = stat ? dayPercent(stat) : null;
              const isSelected = day === selected;
              const label = `${formatLongDate(day)}: ${LEVEL_LABEL[level]}${pct !== null ? `, ${pct}%` : ""}`;
              const content = (
                <>
                  <span className="text-sm font-semibold">{Number(day.slice(8))}</span>
                  {pct !== null && level !== "future" ? <span className="tabular hidden text-[10px] opacity-90 sm:block">{pct}%</span> : null}
                </>
              );
              const cls = cn(
                "flex aspect-square flex-col items-center justify-center rounded-xl transition-transform",
                LEVEL_STYLE[level],
                day === today && "ring-2 ring-primary ring-offset-2 ring-offset-surface",
                isSelected && "scale-105 ring-2 ring-foreground ring-offset-2 ring-offset-surface",
              );
              return (
                <div key={day} role="gridcell">
                  {level === "future" ? (
                    <span className={cls} aria-label={label}>
                      {content}
                    </span>
                  ) : (
                    <Link
                      href={`/calendar?month=${month}&day=${day}`}
                      className={cn(cls, "hover:scale-105")}
                      aria-label={label}
                      aria-current={isSelected ? "date" : undefined}
                      scroll={false}
                    >
                      {content}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted" aria-label="Leyenda">
            {(["complete", "partial", "low", "rest", "none"] as const).map((l) => (
              <li key={l} className="flex items-center gap-1.5">
                <span className={cn("size-3 rounded", LEVEL_STYLE[l])} aria-hidden="true" />
                {LEVEL_LABEL[l]}
                {l === "complete" ? ` (≥ ${threshold}%)` : l === "partial" ? " (≥ 40%)" : ""}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="self-start">
          {selected && detail ? (
            <DayDetail
              day={selected}
              stat={stats.get(selected)}
              threshold={threshold}
              today={today}
              habits={habits.filter((h) => isScheduledOn(h, selected) || detail[0].data?.some((l) => l.habit_id === h.id))}
              logs={new Map((detail[0].data ?? []).map((l) => [l.habit_id, l.status]))}
              workouts={detail[1].data ?? []}
              entry={detail[2].data}
            />
          ) : (
            <CardContent className="p-5 text-sm text-muted">Toca un día para ver sus hábitos, entrenamientos y notas.</CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

const STATUS_ICON: Record<HabitLogStatus, React.ReactNode> = {
  done: <Check className="size-4 text-success" aria-label="Completado" />,
  missed: <X className="size-4 text-danger" aria-label="No completado" />,
  skipped: <Minus className="size-4 text-muted" aria-label="No aplica" />,
};

function DayDetail({
  day,
  stat,
  threshold,
  today,
  habits,
  logs,
  workouts,
  entry,
}: {
  day: string;
  stat: ReturnType<typeof toDayStats>[number] | undefined;
  threshold: number;
  today: string;
  habits: { id: string; name: string; icon: string; color: string }[];
  logs: Map<string, HabitLogStatus>;
  workouts: { id: string; type: keyof typeof WORKOUT_LABELS; duration_min: number; feeling: number | null; notes: string }[];
  entry: { did_today: string; improve_tomorrow: string } | null;
}) {
  const pct = stat ? dayPercent(stat) : null;
  const level = dayLevel(stat, threshold, day, today);
  return (
    <>
      <CardHeader>
        <div>
          <CardTitle className="text-base first-letter:uppercase">{formatLongDate(day)}</CardTitle>
          <p className="tabular mt-1 text-sm text-muted">
            {pct === null ? "Sin hábitos obligatorios" : `${stat!.completed}/${stat!.required} · ${pct}%`}
          </p>
        </div>
        <Badge tone={level === "complete" ? "success" : level === "partial" ? "warning" : level === "low" ? "danger" : "neutral"}>
          {LEVEL_LABEL[level]}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-5">
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Hábitos</h3>
          <ul className="grid gap-1.5">
            {habits.map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-sm">
                <HabitIcon name={h.icon} className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate">{h.name}</span>
                {logs.get(h.id) ? STATUS_ICON[logs.get(h.id)!] : <span className="text-xs text-muted">—</span>}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Entrenamiento</h3>
          {workouts.length === 0 ? (
            <p className="text-sm text-muted">Sin entrenamientos.</p>
          ) : (
            <ul className="grid gap-1.5">
              {workouts.map((w) => (
                <li key={w.id}>
                  <Link href={`/workouts/${w.id}`} className="block rounded-lg bg-surface-2 px-3 py-2 text-sm hover:bg-border/60">
                    {WORKOUT_EMOJI[w.type]} {WORKOUT_LABELS[w.type]} · {w.duration_min} min{w.feeling ? ` · ${w.feeling}/10` : ""}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="grid gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Notas</h3>
          {entry && (entry.did_today || entry.improve_tomorrow) ? (
            <>
              {entry.did_today ? <p className="text-sm whitespace-pre-line break-words"><strong>Hice:</strong> {entry.did_today}</p> : null}
              {entry.improve_tomorrow ? <p className="text-sm whitespace-pre-line break-words"><strong>Mejorar:</strong> {entry.improve_tomorrow}</p> : null}
            </>
          ) : (
            <p className="text-sm text-muted">Sin notas.</p>
          )}
        </section>
      </CardContent>
    </>
  );
}
