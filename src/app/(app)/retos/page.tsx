import type { Metadata } from "next";
import { ArrowDownRight, ArrowUpRight, Medal, Minus, Swords, Target } from "lucide-react";
import { requireGroup } from "@/lib/data/session";
import { getPersonalStats } from "@/lib/data/personal-stats";
import { addDays } from "@/lib/dates";
import { compareWithPast, type PeriodNumbers } from "@/lib/self-compare";
import { challengeProgress } from "@/lib/challenges";
import { logServerError } from "@/lib/errors";
import { ChallengeCard, type ChallengeCardData } from "@/components/challenges/challenge-card";
import { NewChallenge } from "@/components/challenges/new-challenge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Retos" };

/** Versión individual: tú contra tu yo pasado, retos personales y vitrina de medallas. */
export default async function ChallengesPage() {
  const session = await requireGroup();
  const { supabase, userId, today } = session;

  const evaluation = await supabase.rpc("evaluate_my_achievements");
  if (evaluation.error) logServerError("evaluate_my_achievements", evaluation.error);

  const [stats, workoutsRes, challengesRes, achievementsRes, unlockedRes] = await Promise.all([
    getPersonalStats(session),
    supabase.from("workouts").select("workout_date, duration_min").eq("user_id", userId).gte("workout_date", addDays(today, -70)).limit(500),
    supabase.from("personal_challenges").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(60),
    supabase.from("achievements").select("code, emoji, name, description, sort_order").order("sort_order"),
    supabase.from("user_achievements").select("achievement_code").eq("user_id", userId),
  ]);

  const challenges = challengesRes.data ?? [];
  const ids = challenges.map((c) => c.id);
  const { data: checkinRows } = ids.length
    ? await supabase.from("challenge_checkins").select("challenge_id, day").in("challenge_id", ids)
    : { data: [] as { challenge_id: string; day: string }[] };
  const checkins = new Map<string, Set<string>>();
  for (const r of checkinRows ?? []) {
    if (!checkins.has(r.challenge_id)) checkins.set(r.challenge_id, new Set());
    checkins.get(r.challenge_id)!.add(r.day);
  }

  const yesterday = addDays(today, -1);
  const active: ChallengeCardData[] = challenges
    .filter((c) => !c.completed_at && !c.abandoned_at)
    .map((c) => ({ id: c.id, emoji: c.emoji, title: c.title, today, yesterday, progress: challengeProgress(c, checkins.get(c.id) ?? new Set(), today) }));
  const completed = challenges.filter((c) => c.completed_at);

  const comparisons = compareWithPast(
    stats.series,
    (workoutsRes.data ?? []).map((w) => ({ date: w.workout_date, minutes: w.duration_min })),
    today,
  );

  const unlocked = new Set((unlockedRes.data ?? []).map((u) => u.achievement_code));
  const achievements = achievementsRes.data ?? [];
  const medalCount = unlocked.size + completed.length;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Tu rival eres tú</p>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Retos</h1>
        <p className="mt-1 text-sm text-muted">Supera a tu yo de la semana pasada, completa retos y llena tu vitrina.</p>
      </header>

      {/* Tú vs tu yo pasado */}
      <section className="grid gap-3" aria-labelledby="vs-title">
        <h2 id="vs-title" className="flex items-center gap-2 text-lg font-bold">
          <Swords className="size-5 text-ember" aria-hidden="true" /> Tú vs tu yo pasado
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {comparisons.map((c) => (
            <div key={c.label} className="aurora grid gap-3 rounded-3xl border border-border bg-surface p-4 shadow-card">
              <p className="font-bold">
                {c.label} <span className="text-sm font-normal text-muted">vs {c.previousLabel}</span>
              </p>
              <dl className="grid grid-cols-2 gap-2">
                <Versus label="Constancia" now={c.now.percent} before={c.before.percent} unit="%" />
                <Versus label="Días perfectos" now={c.now.perfectDays} before={c.before.perfectDays} />
                <Versus label="Días activos" now={c.now.activeDays} before={c.before.activeDays} />
                <Versus label="Entrenos" now={c.now.workouts} before={c.before.workouts} />
              </dl>
              <p className="text-xs text-muted">{verdict(c.now, c.before, c.previousLabel)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Retos personales */}
      <section className="grid gap-3" aria-labelledby="retos-title">
        <h2 id="retos-title" className="flex items-center gap-2 text-lg font-bold">
          <Target className="size-5 text-primary" aria-hidden="true" /> Mis retos
        </h2>
        {active.length ? (
          <ul className="grid gap-3">
            {active.map((c) => (
              <ChallengeCard key={c.id} c={c} />
            ))}
          </ul>
        ) : (
          <p className="rounded-3xl bg-surface-2 p-4 text-sm text-muted">Aún no tienes retos activos. Elige uno abajo y empieza hoy.</p>
        )}
        <div className="rounded-3xl border border-dashed border-border p-4">
          <p className="mb-3 font-semibold">Nuevo reto</p>
          <NewChallenge disabled={active.length >= 5} />
        </div>
      </section>

      {/* Vitrina de medallas */}
      <section className="grid gap-3" aria-labelledby="medals-title">
        <h2 id="medals-title" className="flex items-center gap-2 text-lg font-bold">
          <Medal className="size-5 text-amber-500" aria-hidden="true" /> Vitrina de medallas
          <span className="ml-auto text-sm font-normal text-muted">{medalCount} conseguidas</span>
        </h2>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {completed.map((c) => (
            <li key={c.id} className="grid justify-items-center gap-1 rounded-2xl border border-amber-400/50 bg-amber-50 p-3 text-center dark:bg-amber-400/10">
              <span className="text-3xl" aria-hidden="true">
                {c.emoji}
              </span>
              <span className="text-xs font-semibold break-words">{c.title}</span>
              <span className="text-[10px] text-muted">Reto de {c.days} días 🏅</span>
            </li>
          ))}
          {achievements.map((a) => {
            const got = unlocked.has(a.code);
            return (
              <li
                key={a.code}
                title={a.description}
                className={cn("grid justify-items-center gap-1 rounded-2xl border border-border p-3 text-center", got ? "bg-surface" : "bg-surface-2 opacity-60")}
              >
                <span className={cn("text-3xl", !got && "grayscale")} aria-hidden="true">
                  {got ? a.emoji : "🔒"}
                </span>
                <span className="text-xs font-semibold">{a.name}</span>
                <span className="text-[10px] text-muted">{a.description}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Versus({ label, now, before, unit = "" }: { label: string; now: number | null; before: number | null; unit?: string }) {
  const diff = now !== null && before !== null ? now - before : null;
  return (
    <div className="rounded-2xl bg-surface-2 p-2.5">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="flex items-baseline gap-1.5">
        <span className="tabular text-xl font-black">{now === null ? "—" : `${now}${unit}`}</span>
        {diff === null ? null : diff > 0 ? (
          <span className="inline-flex items-center text-xs font-semibold text-success">
            <ArrowUpRight className="size-3" aria-hidden="true" />+{diff}
            {unit}
          </span>
        ) : diff < 0 ? (
          <span className="inline-flex items-center text-xs font-semibold text-danger">
            <ArrowDownRight className="size-3" aria-hidden="true" />
            {diff}
            {unit}
          </span>
        ) : (
          <Minus className="size-3 text-muted" aria-label="igual" />
        )}
      </dd>
      <dd className="text-[10px] text-muted">antes: {before === null ? "—" : `${before}${unit}`}</dd>
    </div>
  );
}

function verdict(now: PeriodNumbers, before: PeriodNumbers, previousLabel: string): string {
  const a = now.percent ?? 0;
  const b = before.percent ?? 0;
  if (now.percent === null && before.percent === null) return "Añade hábitos y empieza a marcarlos para ver tu evolución.";
  if (a > b) return `🔥 Vas mejor que la ${previousLabel}. ¡Sigue así!`;
  if (a < b) return `Tu yo de la ${previousLabel} te va ganando… ¡aún estás a tiempo de remontar!`;
  return `Empate con tu yo de la ${previousLabel}. Un día perfecto más y le ganas.`;
}
