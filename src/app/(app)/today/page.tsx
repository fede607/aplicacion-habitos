import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Dumbbell, Plus } from "lucide-react";
import { requireGroup } from "@/lib/data/session";
import { getActiveHabits, getMyLogs } from "@/lib/data/queries";
import { addDays, diffDays, formatLongDate, isIsoDate, startOfIsoWeek } from "@/lib/dates";
import { WORKOUT_EMOJI, WORKOUT_LABELS } from "@/lib/labels";
import { isRequiredOn } from "@/lib/stats";
import type { HabitLogStatus } from "@/lib/database.types";
import { TodayTracker, type TrackerHabit } from "@/components/habits/today-tracker";
import { DailyNotes } from "@/components/habits/daily-notes";
import { ReminderBanner } from "@/components/habits/reminder-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { PasswordUpdatedToast } from "./password-updated-toast";

export const metadata: Metadata = { title: "Hoy" };

const EDIT_WINDOW_DAYS = 7;

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const { supabase, userId, activeGroup, today, profile, settings } = await requireGroup();
  const params = await searchParams;
  const requested = typeof params.date === "string" && isIsoDate(params.date) ? params.date : today;
  // Sólo se puede navegar por la ventana editable (el histórico está en Calendario).
  const date = requested > today || diffDays(today, requested) > EDIT_WINDOW_DAYS ? today : requested;
  const isToday = date === today;
  const weekStart = startOfIsoWeek(date);

  const [habits, logs, entryRes, workoutsRes] = await Promise.all([
    getActiveHabits(supabase, activeGroup.id),
    getMyLogs(supabase, userId, activeGroup.id, weekStart, addDays(weekStart, 6)),
    supabase
      .from("daily_entries")
      .select("did_today, improve_tomorrow, updated_at")
      .eq("user_id", userId)
      .eq("entry_date", date)
      .maybeSingle(),
    supabase
      .from("workouts")
      .select("id, type, duration_min, feeling")
      .eq("user_id", userId)
      .eq("workout_date", date)
      .order("created_at"),
  ]);

  const statuses: Record<string, HabitLogStatus | null> = {};
  const weekDone: Record<string, number> = {};
  for (const log of logs) {
    if (log.log_date === date) statuses[log.habit_id] = log.status;
    else if (log.status === "done") weekDone[log.habit_id] = (weekDone[log.habit_id] ?? 0) + 1;
  }
  const trackerHabits: TrackerHabit[] = habits
    .filter((h) => h.starts_on <= date)
    .map((h) => ({ ...h, weekDone: weekDone[h.id] ?? 0 }));
  const pendingRequired = trackerHabits.filter((h) => isRequiredOn(h, date) && !statuses[h.id]).length;

  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const canPrev = diffDays(today, prev) <= EDIT_WINDOW_DAYS;
  const canNext = next <= today;

  return (
    <div className="grid gap-6">
      <PasswordUpdatedToast show={params.password === "updated"} />
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">{isToday ? "Hoy" : "Editando"}</p>
          <h1 className="truncate text-2xl font-bold tracking-tight first-letter:uppercase sm:text-3xl">{formatLongDate(date)}</h1>
        </div>
        <nav aria-label="Cambiar de día" className="flex shrink-0 gap-1">
          <DayLink href={`/today?date=${prev}`} disabled={!canPrev} label="Día anterior">
            <ChevronLeft />
          </DayLink>
          <DayLink href={`/today?date=${next}`} disabled={!canNext} label="Día siguiente">
            <ChevronRight />
          </DayLink>
          {!isToday ? (
            <Button asChild variant="secondary" size="sm" className="ml-1">
              <Link href="/today">Hoy</Link>
            </Button>
          ) : null}
        </nav>
      </header>

      {isToday ? (
        <ReminderBanner
          enabled={settings.reminder_enabled}
          reminderTime={settings.reminder_time}
          timezone={profile.timezone}
          pendingHabits={pendingRequired}
        />
      ) : null}

      {trackerHabits.length === 0 ? (
        <EmptyState
          title="Tu grupo aún no tiene hábitos"
          description={
            activeGroup.role === "admin"
              ? "Configura los hábitos del Winter Arc desde la administración del grupo."
              : "Pide al administrador del grupo que configure los hábitos."
          }
          action={
            activeGroup.role === "admin" ? (
              <Button asChild>
                <Link href="/group/admin">Configurar hábitos</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <TodayTracker key={date} date={date} habits={trackerHabits} initialStatuses={statuses} editable />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <DailyNotes
          key={date}
          date={date}
          editable
          initial={{
            didToday: entryRes.data?.did_today ?? "",
            improveTomorrow: entryRes.data?.improve_tomorrow ?? "",
            updatedAt: entryRes.data?.updated_at ?? null,
          }}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entrenamiento</CardTitle>
            <Dumbbell className="size-4 text-ember" aria-hidden="true" />
          </CardHeader>
          <CardContent className="grid gap-3">
            {(workoutsRes.data ?? []).length === 0 ? (
              <p className="text-sm text-muted">Sin entrenamientos registrados este día.</p>
            ) : (
              <ul className="grid gap-2">
                {workoutsRes.data!.map((w) => (
                  <li key={w.id}>
                    <Link
                      href={`/workouts/${w.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm hover:bg-border/60"
                    >
                      <span className="font-medium">
                        {WORKOUT_EMOJI[w.type]} {WORKOUT_LABELS[w.type]}
                      </span>
                      <span className="tabular text-muted">
                        {w.duration_min} min{w.feeling ? ` · ${w.feeling}/10` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="outline">
              <Link href={`/workouts/new?date=${date}`}>
                <Plus />
                Registrar entrenamiento
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DayLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className = cn(
    "grid size-10 place-items-center rounded-xl border border-border bg-surface text-foreground [&_svg]:size-5",
    disabled ? "pointer-events-none opacity-40" : "hover:bg-surface-2",
  );
  if (disabled) {
    return (
      <span className={className} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} aria-label={label}>
      {children}
    </Link>
  );
}
