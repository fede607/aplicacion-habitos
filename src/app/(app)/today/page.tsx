import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Dumbbell, NotebookPen, Plus } from "lucide-react";
import { hasFullAccess, requireGroup } from "@/lib/data/session";
import { loadTrainingProfile, planFromRow, todaysSession } from "@/lib/training/user-plan";
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
import { getYearLine } from "@/lib/data/year";
import { YearLineCard } from "@/components/year/year-line";
import { ReviewPrompt } from "@/components/reviews/review-prompt";
import { RecoveryCard } from "@/components/recovery/recovery-card";

export const metadata: Metadata = { title: "Hoy" };

const EDIT_WINDOW_DAYS = 7;

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const session = await requireGroup();
  const { supabase, userId, activeGroup, today, profile, settings } = session;
  const params = await searchParams;
  const requested = typeof params.date === "string" && isIsoDate(params.date) ? params.date : today;
  // Sólo se puede navegar por la ventana editable (el histórico está en Calendario).
  const date = requested > today || diffDays(today, requested) > EDIT_WINDOW_DAYS ? today : requested;
  const isToday = date === today;
  const weekStart = startOfIsoWeek(date);

  const [habits, logs, entryRes, workoutsRes] = await Promise.all([
    getActiveHabits(supabase, activeGroup.id, userId),
    getMyLogs(supabase, userId, activeGroup.id, weekStart, addDays(weekStart, 6)),
    supabase.from("daily_entries").select("did_today, improve_tomorrow, updated_at").eq("user_id", userId).eq("entry_date", date).maybeSingle(),
    supabase.from("workouts").select("id, type, duration_min, feeling").eq("user_id", userId).eq("workout_date", date).order("created_at"),
  ]);

  // Sesión del plan personalizado (Pro) para hoy.
  const full = isToday ? await hasFullAccess(session) : false;
  const trainingRow = full ? await loadTrainingProfile(supabase, userId) : null;
  const planToday = trainingRow ? todaysSession(planFromRow(trainingRow, today), today) : null;

  const { data: hasRecovery } = isToday ? await supabase.rpc("has_recovery_code") : { data: true };
  const yearLine = isToday && habits.length > 0 ? await getYearLine(supabase, activeGroup.id, userId, today) : null;

  // Pedir opinión tras una semana de uso, en un buen momento (día completado) y sólo una vez.
  const weekOld = profile.created_at.slice(0, 10) <= addDays(today, -7);
  const { data: myReview } = isToday && weekOld ? await supabase.from("reviews").select("id").eq("user_id", userId).maybeSingle() : { data: null };
  const askReview = isToday && weekOld && !myReview;

  const statuses: Record<string, HabitLogStatus | null> = {};
  const weekDone: Record<string, number> = {};
  for (const log of logs) {
    if (log.log_date === date) statuses[log.habit_id] = log.status;
    else if (log.status === "done") weekDone[log.habit_id] = (weekDone[log.habit_id] ?? 0) + 1;
  }
  const trackerHabits: TrackerHabit[] = habits.filter((h) => h.starts_on <= date).map((h) => ({ ...h, weekDone: weekDone[h.id] ?? 0 }));
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
        <ReminderBanner enabled={settings.reminder_enabled} reminderTime={settings.reminder_time} timezone={profile.timezone} pendingHabits={pendingRequired} />
      ) : null}

      {trackerHabits.length === 0 ? (
        <EmptyState
          title="Elige tus hábitos"
          description="Cada persona tiene los suyos. Elige 3-5 para empezar: en 10 segundos estás marcando tu primer día."
          action={
            <Button asChild variant="pro" size="lg">
              <Link href="/habits">Elegir mis hábitos</Link>
            </Button>
          }
        />
      ) : (
        <TodayTracker key={date} date={date} habits={trackerHabits} initialStatuses={statuses} editable />
      )}

      {hasRecovery === false ? <RecoveryCard hasCode={false} banner /> : null}

      {askReview && trackerHabits.length > 0 && pendingRequired === 0 ? <ReviewPrompt /> : null}

      {yearLine ? <YearLineCard data={yearLine} /> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <details className="group rounded-3xl border border-border bg-surface" open={Boolean(entryRes.data?.did_today || entryRes.data?.improve_tomorrow)}>
          <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2">
              <NotebookPen className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Diario del día</span>
              <span className="block text-xs text-muted">Qué hiciste bien y qué mejorar mañana</span>
            </span>
            <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="px-2 pb-2">
            <DailyNotes
              key={date}
              date={date}
              editable
              bare
              initial={{
                didToday: entryRes.data?.did_today ?? "",
                improveTomorrow: entryRes.data?.improve_tomorrow ?? "",
                updatedAt: entryRes.data?.updated_at ?? null,
              }}
            />
          </div>
        </details>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entrenamiento</CardTitle>
            <Dumbbell className="size-4 text-ember" aria-hidden="true" />
          </CardHeader>
          <CardContent className="grid gap-3">
            {planToday && (workoutsRes.data ?? []).length === 0 ? (
              <Link href="/workouts/new?from=plan" className="pro-gradient flex items-center gap-3 rounded-2xl p-3 transition-transform active:scale-[0.99]">
                <Dumbbell className="size-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold opacity-90">Tu plan · hoy toca</span>
                  <span className="block truncate font-bold">{planToday.title}</span>
                </span>
                <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
              </Link>
            ) : null}
            {(workoutsRes.data ?? []).length === 0 ? (
              planToday ? null : (
                <p className="text-sm text-muted">Sin entrenamientos registrados este día.</p>
              )
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
                        {w.duration_min} min
                        {w.feeling ? ` · ${w.feeling}/10` : ""}
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

function DayLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
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
