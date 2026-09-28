import type { Metadata } from "next";
import { Flame, Sparkles, Trophy } from "lucide-react";
import { requireGroup } from "@/lib/data/session";
import { getPersonalStats } from "@/lib/data/personal-stats";
import { getActiveHabits, getMyLogs, getXpInputs, indexLogs } from "@/lib/data/queries";
import { addDays, formatShortDate, startOfIsoWeek } from "@/lib/dates";
import { describeFrequency } from "@/lib/labels";
import { computeXp, habitStreak, levelFromXp, summarize } from "@/lib/stats";
import { logServerError } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Stat } from "@/components/ui/stat";
import { HabitIcon } from "@/components/habits/habit-icon";
import { NewAchievementsToast } from "./new-achievements-toast";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Progreso" };

export default async function ProgressPage() {
  const session = await requireGroup();
  const { supabase, userId, activeGroup, today } = session;

  // Los logros se evalúan en BD con datos reales (idempotente).
  const evaluation = await supabase.rpc("evaluate_my_achievements");
  if (evaluation.error) logServerError("evaluate_my_achievements", evaluation.error);
  const newlyUnlocked = evaluation.data ?? [];

  const lookbackFrom = addDays(today, -370);
  const [stats, habits, logs, xpInputs, achievementsRes] = await Promise.all([
    getPersonalStats(session),
    getActiveHabits(supabase, activeGroup.id),
    getMyLogs(supabase, userId, activeGroup.id, lookbackFrom < activeGroup.start_date ? activeGroup.start_date : lookbackFrom, today),
    getXpInputs(supabase, userId),
    supabase.from("achievements").select("*").order("sort_order"),
  ]);

  const achievements = achievementsRes.data ?? [];
  const unlocked = new Set(xpInputs.unlockedCodes);
  const achievementXp = achievements.filter((a) => unlocked.has(a.code)).reduce((acc, a) => acc + a.xp, 0);
  const xp = computeXp({ ...xpInputs, achievementXp });
  const level = levelFromXp(xp);
  const logIndex = indexLogs(logs);

  // Últimas 8 semanas.
  const thisWeek = startOfIsoWeek(today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, -7 * (7 - i))).map((start) => {
    const end = addDays(start, 6) < today ? addDays(start, 6) : today;
    return { start, totals: summarize(stats.series, start, end) };
  });

  return (
    <div className="grid gap-6">
      <NewAchievementsToast codes={newlyUnlocked} names={Object.fromEntries(achievements.map((a) => [a.code, `${a.emoji} ${a.name}`]))} />
      <header>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Progreso</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Constancia y logros</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Rachas y nivel">
        <Stat label="Racha actual" icon={<Flame />} tone="ember" value={`🔥 ${stats.streaks.current} días`} sub="consecutivos cumpliendo el objetivo" />
        <Stat label="Mejor racha" icon={<Trophy />} tone="ember" value={`${stats.streaks.best} días`} />
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium tracking-wide text-muted uppercase">
            <span>Nivel</span>
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
          </div>
          <p className="tabular mt-2 text-3xl font-bold tracking-tight">
            {level.level} <span className="text-base font-medium text-muted">· {xp} XP</span>
          </p>
          <ProgressBar value={level.progress} className="mt-3" label={`Progreso al nivel ${level.level + 1}`} />
          <p className="tabular mt-1 text-xs text-muted">{level.next - xp} XP para el nivel {level.level + 1}</p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Racha por hábito</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {habits.map((h) => {
                const streak = habitStreak(h, logIndex.get(h.id) ?? new Map(), today);
                return (
                  <li key={h.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${h.color}22`, color: h.color }}>
                      <HabitIcon name={h.icon} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{h.name}</span>
                      <span className="block text-xs text-muted">{describeFrequency(h)}</span>
                    </span>
                    <span className={cn("tabular shrink-0 text-sm font-bold", streak.value > 0 ? "text-ember" : "text-muted")}>
                      {streak.value > 0 ? "🔥 " : ""}
                      {streak.value} {streak.unit === "weeks" ? (streak.value === 1 ? "semana" : "semanas") : streak.value === 1 ? "día" : "días"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas 8 semanas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {weeks.map(({ start, totals }) => (
                <li key={start} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="text-muted">{formatShortDate(start)}</span>
                  <ProgressBar value={totals.percent ?? 0} tone={(totals.percent ?? 0) >= activeGroup.streak_threshold ? "success" : "primary"} label={`Semana del ${formatShortDate(start)}`} />
                  <span className="tabular text-right font-semibold">{totals.percent === null ? "—" : `${totals.percent}%`}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">Hábitos completados / hábitos obligatorios de cada semana.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logros</CardTitle>
          <span className="tabular text-sm text-muted">
            {unlocked.size}/{achievements.length}
          </span>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {achievements.map((a) => {
              const got = unlocked.has(a.code);
              return (
                <li
                  key={a.code}
                  className={cn("rounded-2xl border border-border p-3 transition-opacity", got ? "bg-primary-soft/60" : "bg-surface-2 opacity-60")}
                >
                  <p className={cn("text-2xl", !got && "grayscale")} aria-hidden="true">
                    {a.emoji}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{a.name}</p>
                  <p className="text-xs text-muted">{a.description}</p>
                  <p className="mt-1 text-xs font-semibold text-primary">{got ? "Desbloqueado" : `+${a.xp} XP`}</p>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-muted">
            XP: 10 por hábito completado, 20 por entrenamiento, 5 por día con notas y el bonus de cada logro.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
