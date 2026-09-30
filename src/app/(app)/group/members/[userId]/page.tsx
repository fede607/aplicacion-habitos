import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarCheck,
  ChevronLeft,
  Clock,
  Dumbbell,
  Flame,
  Lock,
  Target,
  TrendingUp,
} from "lucide-react";
import { requireGroup } from "@/lib/data/session";
import { statsFrom } from "@/lib/data/stats-range";
import { getActiveHabits, getDailyStats, toDayStats } from "@/lib/data/queries";
import {
  addDays,
  eachDay,
  formatMinutes,
  startOfIsoWeek,
  startOfMonth,
} from "@/lib/dates";
import { computeStreaks, isScheduledOn, summarize } from "@/lib/stats";
import { uuidSchema } from "@/lib/validation";
import { getMemberRank } from "@/lib/data/rank";
import { PHASE_LABELS } from "@/lib/rank/engine";
import { getTier } from "@/lib/rank/tiers";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { HabitCategory } from "@/lib/database.types";
import { RankEmblem } from "@/components/rank/rank-emblem";
import { ChallengeButton } from "@/components/social/duel-actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Stat } from "@/components/ui/stat";
import { HabitIcon } from "@/components/habits/habit-icon";
import { RecentDaysChart } from "@/components/stats/recent-days-chart";

export const metadata: Metadata = { title: "Estadísticas del miembro" };

export default async function MemberStatsPage({
  params,
}: PageProps<"/group/members/[userId]">) {
  const { userId: memberId } = await params;
  if (!uuidSchema.safeParse(memberId).success) notFound();
  const { supabase, userId, activeGroup, today } = await requireGroup();

  // RLS: sólo devuelve la fila si ambos estáis en el grupo.
  const [memberRes, profileRes] = await Promise.all([
    supabase
      .from("group_members")
      .select("role, joined_at")
      .eq("group_id", activeGroup.id)
      .eq("user_id", memberId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, username, avatar_emoji, avatar_color, timezone")
      .eq("id", memberId)
      .maybeSingle(),
  ]);
  if (!memberRes.data || !profileRes.data) notFound();
  const member = { ...memberRes.data, ...profileRes.data };
  const isMe = memberId === userId;

  const from = statsFrom(activeGroup.start_date, today);
  const weekStart = startOfIsoWeek(today) < from ? from : startOfIsoWeek(today);
  const [rows, habits, workoutsArc, workoutsWeek, logsRes, rank] =
    await Promise.all([
      getDailyStats(supabase, activeGroup.id, from, today, memberId),
      getActiveHabits(supabase, activeGroup.id),
      supabase.rpc("group_workout_summary", {
        p_group_id: activeGroup.id,
        p_from: from,
        p_to: today,
      }),
      supabase.rpc("group_workout_summary", {
        p_group_id: activeGroup.id,
        p_from: startOfIsoWeek(today),
        p_to: today,
      }),
      supabase
        .from("habit_logs")
        .select("habit_id, log_date, status")
        .eq("user_id", memberId)
        .eq("group_id", activeGroup.id)
        .gte("log_date", startOfIsoWeek(today))
        .lte("log_date", today),
      getMemberRank(supabase, {
        group: activeGroup,
        memberId,
        joinedAt: member.joined_at,
        timeZone: member.timezone,
        today,
      }),
    ]);
  const mr = rank.result.global;

  const series = toDayStats(rows);
  const shares = series.length > 0;
  const threshold = activeGroup.streak_threshold;
  const wArc = (workoutsArc.data ?? []).find((w) => w.user_id === memberId);
  const wWeek = (workoutsWeek.data ?? []).find((w) => w.user_id === memberId);
  const statByDay = new Map(series.map((s) => [s.day, s]));
  const last14 = eachDay(addDays(today, -13), today).map(
    (day) =>
      statByDay.get(day) ?? {
        day,
        required: 0,
        completed: 0,
        skipped: 0,
        bonus: 0,
      },
  );
  const weekDays = eachDay(startOfIsoWeek(today), today);
  const doneByHabit = new Map<string, number>();
  for (const l of logsRes.data ?? [])
    if (l.status === "done")
      doneByHabit.set(l.habit_id, (doneByHabit.get(l.habit_id) ?? 0) + 1);

  const todayT = summarize(series, today, today);
  const week = summarize(series, weekStart, today);
  const month = summarize(
    series,
    startOfMonth(today) < from ? from : startOfMonth(today),
    today,
  );
  const arc = summarize(series, from, today);
  const streaks = computeStreaks(series, threshold, today);

  return (
    <div className="grid gap-6">
      <header className="grid gap-3">
        <Link
          href="/group"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" /> Grupo
        </Link>
        <div className="flex items-center gap-4">
          <Avatar
            name={member.display_name}
            emoji={member.avatar_emoji}
            color={member.avatar_color}
            size="lg"
          />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {member.display_name}{" "}
              {isMe ? (
                <span className="text-base font-normal text-muted">(tú)</span>
              ) : null}
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              @{member.username}
              {member.role === "admin" ? (
                <Badge tone="primary">Admin</Badge>
              ) : null}
            </p>
          </div>
        </div>
        {!isMe && shares ? (
          <ChallengeButton
            groupId={activeGroup.id}
            opponentId={memberId}
            name={member.display_name}
          />
        ) : null}
      </header>

      {!shares ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-5 text-sm text-muted">
            <Lock className="size-5 shrink-0" aria-hidden="true" />
            {member.display_name} ha elegido mantener sus estadísticas de
            hábitos en privado.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
              <RankEmblem tierIndex={mr.tierIndex} size={64} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-widest text-muted uppercase">
                  Rango
                </p>
                <p className="text-xl font-black tracking-tight uppercase">
                  {mr.tierIndex === null
                    ? "Sin rango aún"
                    : getTier(mr.tierIndex).name}
                </p>
                {mr.score !== null ? (
                  <p className="tabular text-xs text-muted">
                    {mr.score.toLocaleString("es-ES", {
                      maximumFractionDigits: 1,
                    })}{" "}
                    / 100 · {PHASE_LABELS[mr.phase]}
                  </p>
                ) : null}
              </div>
              <ul className="flex flex-wrap gap-2">
                {(Object.keys(rank.result.categories) as HabitCategory[]).map(
                  (c) => {
                    const t = rank.result.categories[c]!.tierIndex;
                    return (
                      <li
                        key={c}
                        className="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pr-3 pl-1 text-xs"
                      >
                        <RankEmblem tierIndex={t} size={22} />
                        <span className="text-muted">
                          {CATEGORY_LABELS[c].split(" /")[0]}
                        </span>
                        <span className="font-semibold">
                          {t === null ? "—" : getTier(t).name}
                        </span>
                      </li>
                    );
                  },
                )}
              </ul>
            </CardContent>
          </Card>

          <section
            className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
            aria-label="Estadísticas actuales"
          >
            <Stat
              label="Hoy"
              icon={<Target />}
              tone="primary"
              value={todayT.percent === null ? "—" : `${todayT.percent}%`}
              sub={`${todayT.completed} / ${todayT.required} hábitos`}
            />
            <Stat
              label="Esta semana"
              icon={<CalendarCheck />}
              tone="primary"
              value={week.percent === null ? "—" : `${week.percent}%`}
              sub={`${week.completed} / ${week.required} hábitos`}
            />
            <Stat
              label="Este mes"
              icon={<TrendingUp />}
              tone="primary"
              value={month.percent === null ? "—" : `${month.percent}%`}
              sub={`${month.activeDays} días activos`}
            />
            <Stat
              label="Racha"
              icon={<Flame />}
              tone="ember"
              value={`🔥 ${streaks.current}`}
              sub={`Mejor: ${streaks.best} días`}
            />
            <Stat
              label="Total del arc"
              icon={<Target />}
              tone="success"
              value={arc.percent === null ? "—" : `${arc.percent}%`}
              sub={`${arc.activeDays} días activos`}
            />
            <Stat
              label="Entrenos semana"
              icon={<Dumbbell />}
              tone="ember"
              value={wWeek ? wWeek.workouts : "🔒"}
              sub={wWeek ? formatMinutes(wWeek.minutes) : "Privado"}
            />
            <Stat
              label="Entrenos arc"
              icon={<Dumbbell />}
              tone="ember"
              value={wArc ? wArc.workouts : "🔒"}
            />
            <Stat
              label="Tiempo entrenando"
              icon={<Clock />}
              tone="ember"
              value={wArc ? formatMinutes(wArc.minutes) : "🔒"}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimos 14 días</CardTitle>
              </CardHeader>
              <CardContent>
                <RecentDaysChart days={last14} threshold={threshold} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hábitos esta semana</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3">
                  {habits.map((h) => {
                    const target =
                      h.frequency === "weekly_target"
                        ? (h.weekly_target ?? 1)
                        : weekDays.filter((d) => isScheduledOn(h, d)).length;
                    const done = doneByHabit.get(h.id) ?? 0;
                    return (
                      <li key={h.id} className="grid gap-1.5">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex min-w-0 items-center gap-2 font-medium">
                            <HabitIcon
                              name={h.icon}
                              className="size-4 shrink-0 text-muted"
                            />
                            <span className="truncate">{h.name}</span>
                          </span>
                          <span className="tabular shrink-0 text-muted">
                            {done}/{target}
                          </span>
                        </div>
                        <ProgressBar
                          value={target ? (done / target) * 100 : 0}
                          tone={
                            target && done >= target ? "success" : "primary"
                          }
                          label={`${h.name}: ${done} de ${target}`}
                        />
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      <p className="text-xs text-muted">
        Las notas diarias y los detalles de los entrenamientos son siempre
        privados.
      </p>
    </div>
  );
}
