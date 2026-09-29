import type { Metadata } from "next";
import { CalendarCheck, CalendarX, Coffee, Flame, Gauge, Mountain, Target, Trophy } from "lucide-react";
import { requireFullAccess } from "@/lib/data/session";
import { getMemberRank, getPreviousSnapshot, persistRankSnapshots } from "@/lib/data/rank";
import type { HabitCategory } from "@/lib/database.types";
import { CATEGORY_LABELS } from "@/lib/labels";
import { PHASE_LABELS, type ScopeRank } from "@/lib/rank/engine";
import { getTier } from "@/lib/rank/tiers";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { Stat } from "@/components/ui/stat";
import { HabitIcon } from "@/components/habits/habit-icon";
import { RankEmblem } from "@/components/rank/rank-emblem";
import { RankExplainer } from "@/components/rank/rank-explainer";
import { RankChange } from "@/components/rank/rank-change";
import { RankHistoryChart } from "@/components/rank/rank-history-chart";

export const metadata: Metadata = { title: "Rango" };

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

const CATEGORY_ORDER: HabitCategory[] = ["physical", "mental", "productivity", "health", "other"];

export default async function RankPage() {
  const { supabase, userId, activeGroup, today, profile } = await requireFullAccess();

  const [previous, { result, habits }] = await Promise.all([
    getPreviousSnapshot(supabase, userId, activeGroup.id, today),
    getMemberRank(supabase, {
      group: activeGroup,
      memberId: userId,
      joinedAt: activeGroup.joined_at,
      timeZone: profile.timezone,
      today,
    }),
  ]);
  await persistRankSnapshots(supabase, userId, activeGroup.id, result, today);

  const g = result.global;
  const header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Rango</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tu disciplina</h1>
      </div>
      <RankExplainer components={g.components} demandFactor={g.demandFactor} threshold={result.threshold} />
    </header>
  );

  if (g.score === null || g.tierIndex === null) {
    return (
      <div className="grid gap-6">
        {header}
        <EmptyState
          icon={<Mountain />}
          title={activeGroup.start_date > today ? "Tu rango se desbloquea cuando empiece el arc" : "Aún no hay días puntuados"}
          description="Completa tus hábitos de hoy: al terminar el día tendrás tu primer rango provisional."
        />
      </div>
    );
  }

  const tier = getTier(g.tierIndex);
  const provisional = g.phase === "provisional" || g.phase === "estimated";
  const chartPoints = g.history
    .filter((p) => p.score !== null && p.tierIndex !== null)
    .map((p) => ({ date: p.date, score: p.score!, tierIndex: p.tierIndex! }));
  const habitRows = habits
    .map((h) => ({ h, r: result.habits[h.id] as ScopeRank | undefined }))
    .filter((x): x is { h: (typeof habits)[number]; r: ScopeRank } => !!x.r && !x.h.archived);

  return (
    <div className="grid gap-6">
      {header}

      {previous && previous.tier_index !== g.tierIndex ? (
        <RankChange groupId={activeGroup.id} today={today} from={previous.tier_index} to={g.tierIndex} />
      ) : null}

      <Card className="aurora overflow-hidden">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:p-8">
          <div className="flex justify-center">
            <RankEmblem tierIndex={g.tierIndex} size={132} />
          </div>
          <div className="grid gap-3 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge tone={provisional ? "warning" : g.phase === "stable" ? "success" : "primary"}>{PHASE_LABELS[g.phase]}</Badge>
              <span className="text-xs text-muted">
                {g.scoredDays} {g.scoredDays === 1 ? "día puntuado" : "días puntuados"}
              </span>
            </div>
            <h2 className="text-4xl font-black tracking-tight uppercase sm:text-5xl">
              {provisional ? <span className="text-muted">~</span> : null}
              {tier.name}
            </h2>
            <p className="tabular text-lg font-semibold">
              {provisional ? "≈ " : ""}
              {fmt(g.score)} <span className="text-sm font-medium text-muted">/ 100</span>
            </p>
            <ProgressBar value={g.progress} label={g.next ? `Progreso hacia ${g.next.name}` : "Rango máximo"} className="h-2.5" />
            <p className="text-sm text-muted">
              {g.next ? (
                <>
                  Siguiente: <span className="font-semibold text-foreground">{g.next.name}</span> · +{fmt(g.next.pointsNeeded)} puntos
                </>
              ) : (
                "Has alcanzado la cima. Mantenla."
              )}
            </p>
            {provisional ? (
              <p className="text-xs text-muted">Con pocos días la confianza es baja: tu rango se irá ajustando y se estabiliza a los 30 días.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Estadísticas de disciplina">
        <Stat label="Racha actual" icon={<Flame />} tone="ember" value={`${g.currentStreak} ${g.currentStreak === 1 ? "día" : "días"}`} />
        <Stat label="Mejor racha" icon={<Trophy />} tone="ember" value={`${g.bestStreak} ${g.bestStreak === 1 ? "día" : "días"}`} />
        <Stat label="Consistencia" icon={<Gauge />} tone="primary" value={g.consistency === null ? "—" : `${g.consistency}%`} sub="días cumplidos (últimos 30)" />
        <Stat
          label="Mejor nivel"
          icon={<Mountain />}
          tone="primary"
          value={g.peakTierIndex === null ? "—" : getTier(g.peakTierIndex).name}
          sub={g.peakScore === null ? undefined : `Score histórico: ${fmt(g.peakScore)}`}
        />
        <Stat label="Días cumplidos" icon={<CalendarCheck />} tone="success" value={g.completeDays} sub={`≥ ${result.threshold}% del día`} />
        <Stat label="Días parciales" icon={<Target />} tone="primary" value={g.partialDays} sub="entre 40% y el objetivo" />
        <Stat label="Días fallados" icon={<CalendarX />} value={g.failedDays} sub="por debajo del 40%" />
        <Stat label="Días de descanso" icon={<Coffee />} value={g.restDays} sub="no cuentan en el rango" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {CATEGORY_ORDER.filter((c) => result.categories[c]).map((c) => {
                const r = result.categories[c]!;
                return <ScopeRow key={c} label={CATEGORY_LABELS[c]} rank={r} />;
              })}
            </ul>
            <p className="mt-4 text-xs text-muted">Cada categoría usa el mismo algoritmo sólo con sus hábitos: así ves tus puntos fuertes y débiles.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolución</CardTitle>
          </CardHeader>
          <CardContent>
            <RankHistoryChart points={chartPoints} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por hábito</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {habitRows.map(({ h, r }) => (
              <ScopeRow
                key={h.id}
                label={h.name}
                sub={h.weight > 1 ? `Peso ×${fmt(h.weight)}` : undefined}
                icon={
                  <span className="grid size-5 place-items-center" style={{ color: h.color }}>
                    <HabitIcon name={h.icon} className="size-4" />
                  </span>
                }
                rank={r}
              />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ScopeRow({ label, sub, icon, rank }: { label: string; sub?: string; icon?: React.ReactNode; rank: ScopeRank }) {
  const t = rank.tierIndex === null ? null : getTier(rank.tierIndex);
  return (
    <li className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
      <RankEmblem tierIndex={rank.tierIndex} size={36} />
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
            {icon}
            <span className="truncate">{label}</span>
          </span>
          <span className="shrink-0 text-xs font-bold tracking-wide uppercase">{t?.name ?? "—"}</span>
        </div>
        <ProgressBar value={rank.score ?? 0} label={`${label}: ${rank.score === null ? "sin datos" : fmt(rank.score)} de 100`} className="h-1.5" />
        <span className="tabular text-xs text-muted">
          {rank.score === null ? "—" : `${fmt(rank.score)} / 100`}
          {sub ? ` · ${sub}` : ""}
          {rank.phase !== "stable" ? ` · ${PHASE_LABELS[rank.phase].toLowerCase()}` : ""}
        </span>
      </div>
    </li>
  );
}
