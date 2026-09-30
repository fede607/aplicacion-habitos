import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Settings2, Users } from "lucide-react";
import { requireGroup } from "@/lib/data/session";
import { statsFrom } from "@/lib/data/personal-stats";
import { getDailyStats, toDayStats } from "@/lib/data/queries";
import { formatMinutes, startOfIsoWeek } from "@/lib/dates";
import { computeStreaks, summarize, type DayStat } from "@/lib/stats";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { GroupRealtime } from "@/components/groups/group-realtime";
import { GroupActions, InviteCodeBox } from "@/components/groups/group-actions";
import { getSiteUrl } from "@/lib/env";
import { getGroupDuels, getGroupFeed } from "@/lib/data/social";
import { ActivityFeed } from "@/components/social/activity-feed";
import { DuelsSection } from "@/components/social/duels-section";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Grupo" };

const PAGE_SIZE = 24;

type MemberView = {
  userId: string;
  name: string;
  username: string;
  emoji: string | null;
  color: string;
  role: "admin" | "member";
  isMe: boolean;
  sharesHabits: boolean;
  inComparison: boolean;
  arcPercent: number | null;
  activeDays: number;
  streak: number;
  weekPercent: number | null;
  weekDone: number;
  weekRequired: number;
  weekDays: number;
  workouts: number | null;
  minutes: number | null;
  loggedToday: boolean;
};

export default async function GroupPage({ searchParams }: PageProps<"/group">) {
  const { supabase, userId, activeGroup, today } = await requireGroup();
  const params = await searchParams;
  const compare = activeGroup.comparison_enabled && params.view === "compare";
  const page = Math.max(0, Number.parseInt(typeof params.page === "string" ? params.page : "0", 10) || 0);

  const from = statsFrom(activeGroup.start_date, today);
  const weekStart = startOfIsoWeek(today) < from ? from : startOfIsoWeek(today);

  const isAdmin = activeGroup.role === "admin";
  const inviteQuery = isAdmin
    ? supabase
        .from("group_invitations")
        .select("code, expires_at, max_uses, use_count")
        .eq("group_id", activeGroup.id)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(10)
    : Promise.resolve({ data: [] as { code: string; expires_at: string | null; max_uses: number | null; use_count: number }[] });
  const [membersRes, visibilityRes, statsRows, workoutsRes, feed, duels, invitesRes] = await Promise.all([
    supabase.from("group_members").select("user_id, role, joined_at").eq("group_id", activeGroup.id).order("joined_at").limit(1000),
    supabase.rpc("group_member_visibility", { p_group_id: activeGroup.id }),
    getDailyStats(supabase, activeGroup.id, from, today),
    supabase.rpc("group_workout_summary", { p_group_id: activeGroup.id, p_from: from, p_to: today }),
    getGroupFeed(supabase, activeGroup.id, userId),
    getGroupDuels(supabase, { group: activeGroup, userId, today }),
    inviteQuery,
  ]);
  const nowIso = new Date().toISOString();
  const inviteCode =
    (invitesRes.data ?? []).find((i) => (!i.expires_at || i.expires_at > nowIso) && (i.max_uses === null || i.use_count < i.max_uses))?.code ?? null;

  const memberRows = membersRes.data ?? [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_emoji, avatar_color")
    .in("id", memberRows.map((m) => m.user_id));

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const visibility = new Map((visibilityRes.data ?? []).map((v) => [v.user_id, v]));
  const workouts = new Map((workoutsRes.data ?? []).map((w) => [w.user_id, w]));
  const seriesByUser = new Map<string, DayStat[]>();
  for (const row of statsRows) {
    const list = seriesByUser.get(row.user_id) ?? [];
    list.push(...toDayStats([row]));
    seriesByUser.set(row.user_id, list);
  }

  const members: MemberView[] = memberRows.map((m) => {
    const p = profileById.get(m.user_id);
    const series = seriesByUser.get(m.user_id);
    const vis = visibility.get(m.user_id);
    const arc = series ? summarize(series, from, today) : null;
    const week = series ? summarize(series, weekStart, today) : null;
    const w = workouts.get(m.user_id);
    const todayStat = series?.find((s) => s.day === today);
    return {
      userId: m.user_id,
      name: p?.display_name ?? "Miembro",
      username: p?.username ?? "",
      emoji: p?.avatar_emoji ?? null,
      color: p?.avatar_color ?? "#64748b",
      role: m.role,
      isMe: m.user_id === userId,
      sharesHabits: Boolean(series),
      inComparison: vis?.show_in_comparison ?? false,
      arcPercent: arc?.percent ?? null,
      activeDays: arc?.activeDays ?? 0,
      streak: series ? computeStreaks(series, activeGroup.streak_threshold, today).current : 0,
      weekPercent: week?.percent ?? null,
      weekDone: week?.completed ?? 0,
      weekRequired: week?.required ?? 0,
      weekDays: series?.filter((d) => d.day >= weekStart && d.day <= today && d.required > 0).length ?? 0,
      workouts: w ? w.workouts : null,
      minutes: w ? w.minutes : null,
      loggedToday: Boolean(todayStat && todayStat.completed + todayStat.bonus + todayStat.skipped > 0),
    };
  });

  const sharing = members.filter((m) => m.sharesHabits);
  const collectiveDone = sharing.reduce((a, m) => a + m.weekDone, 0);
  const collectiveRequired = sharing.reduce((a, m) => a + m.weekRequired, 0);
  const collectivePct = collectiveRequired ? Math.round((collectiveDone / collectiveRequired) * 100) : 0;
  const activeToday = members.filter((m) => m.loggedToday).length;

  const ordered = compare
    ? members.filter((m) => m.inComparison && m.sharesHabits).sort((a, b) => (b.arcPercent ?? -1) - (a.arcPercent ?? -1) || b.streak - a.streak)
    : [...members].sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name, "es"));
  const pageItems = ordered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pages = Math.ceil(ordered.length / PAGE_SIZE);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Grupo</p>
          <h1 className="text-2xl font-bold tracking-tight break-words sm:text-3xl">{activeGroup.name}</h1>
          {activeGroup.description ? <p className="mt-1 max-w-2xl text-sm text-muted">{activeGroup.description}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <GroupRealtime groupId={activeGroup.id} />
          {isAdmin ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/group/admin">
                <Settings2 aria-hidden="true" />
                Administrar
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <GroupActions siteUrl={getSiteUrl()} />

      {isAdmin && inviteCode ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invita a tus amigos a «{activeGroup.name}»</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteCodeBox code={inviteCode} siteUrl={getSiteUrl()} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="aurora">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
          <div>
            <p className="text-sm font-medium text-muted">Progreso colectivo esta semana</p>
            <p className="tabular mt-1 text-3xl font-bold tracking-tight">
              {collectiveDone} <span className="text-lg text-muted">/ {collectiveRequired} hábitos</span>
            </p>
            <ProgressBar value={collectivePct} className="mt-3 h-3" tone={collectivePct >= activeGroup.streak_threshold ? "success" : "primary"} label="Progreso colectivo" />
            <p className="mt-2 text-sm text-muted">
              Juntos lleváis un {collectivePct}% esta semana. Cada hábito de cada uno suma para todos.
            </p>
          </div>
          <div className="flex gap-6 sm:flex-col sm:gap-2 sm:text-right">
            <div>
              <p className="tabular text-2xl font-bold">{activeToday}/{members.length}</p>
              <p className="text-xs text-muted">activos hoy</p>
            </div>
            <div>
              <p className="tabular text-2xl font-bold">{members.length}</p>
              <p className="text-xs text-muted">miembros</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <DuelsSection duels={duels} />
        <ActivityFeed groupId={activeGroup.id} items={feed.items} nowMs={feed.now} />
      </div>

      {activeGroup.rules ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reglas del grupo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line break-words text-muted">{activeGroup.rules}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Users className="size-4" aria-hidden="true" />
            {compare ? "Comparación" : "Miembros"}
          </h2>
          {activeGroup.comparison_enabled ? (
            <div className="inline-flex rounded-xl border border-border bg-surface-2 p-1 text-sm" role="tablist" aria-label="Vista">
              <Link href="/group" role="tab" aria-selected={!compare} className={cn("rounded-lg px-3 py-1.5 font-medium text-muted", !compare && "bg-surface text-foreground shadow-sm")}>
                Juntos
              </Link>
              <Link href="/group?view=compare" role="tab" aria-selected={compare} className={cn("rounded-lg px-3 py-1.5 font-medium text-muted", compare && "bg-surface text-foreground shadow-sm")}>
                Comparar
              </Link>
            </div>
          ) : null}
        </div>
        {compare ? (
          <p className="text-xs text-muted">Sólo aparecen quienes han aceptado salir en la comparación. Es para motivar, no para juzgar.</p>
        ) : null}

        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((m, index) => (
            <li key={m.userId}>
              <MemberCard member={m} rank={compare ? page * PAGE_SIZE + index + 1 : null} />
            </li>
          ))}
        </ul>

        {pages > 1 ? (
          <nav aria-label="Paginación de miembros" className="flex justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => (
              <Link
                key={i}
                href={`/group?${compare ? "view=compare&" : ""}page=${i}`}
                aria-current={i === page ? "page" : undefined}
                className={cn("grid size-10 place-items-center rounded-xl border border-border text-sm", i === page && "bg-primary text-primary-foreground")}
              >
                {i + 1}
              </Link>
            ))}
          </nav>
        ) : null}
      </section>
    </div>
  );
}

function MemberCard({ member: m, rank }: { member: MemberView; rank: number | null }) {
  return (
    <div className={cn("relative h-full rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2", m.isMe && "border-primary/50")}>
      <div className="flex items-center gap-3">
        {rank ? <span className="tabular w-6 text-center text-sm font-bold text-muted">{rank}</span> : null}
        <Avatar name={m.name} emoji={m.emoji} color={m.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            <Link href={`/group/members/${m.userId}`} className="after:absolute after:inset-0 hover:underline">
              {m.name}
            </Link>{" "}
            {m.isMe ? <span className="text-xs font-normal text-muted">(tú)</span> : null}
          </p>
          <p className="truncate text-xs text-muted">@{m.username}</p>
        </div>
        {m.role === "admin" ? <Badge tone="primary">Admin</Badge> : null}
      </div>
      {m.sharesHabits ? (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface-2 py-2">
              <dt className="text-[11px] text-muted">Cumplimiento</dt>
              <dd className="tabular font-bold">{m.arcPercent === null ? "—" : `${m.arcPercent}%`}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 py-2">
              <dt className="text-[11px] text-muted">Racha</dt>
              <dd className="tabular font-bold text-ember">{m.streak > 0 ? `🔥${m.streak}` : "0"}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 py-2">
              <dt className="text-[11px] text-muted">Días activos</dt>
              <dd className="tabular font-bold">{m.activeDays}</dd>
            </div>
          </dl>
          <div className="mt-3 grid gap-1">
            <div className="flex justify-between text-xs text-muted">
              <span>
                Esta semana · {m.weekDays} {m.weekDays === 1 ? "día" : "días"}
              </span>
              <span className="tabular">
                {m.weekDone}/{m.weekRequired} hábitos
              </span>
            </div>
            <ProgressBar value={m.weekPercent ?? 0} label={`Semana de ${m.name}`} />
          </div>
        </>
      ) : (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-muted">
          <Lock className="size-4" aria-hidden="true" /> Estadísticas privadas
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        {m.workouts === null ? "Entrenamientos privados" : `💪 ${m.workouts} entrenos · ${formatMinutes(m.minutes ?? 0)}`}
      </p>
    </div>
  );
}
