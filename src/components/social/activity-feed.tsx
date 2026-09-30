"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flame, Swords, Target, Trophy, UserPlus } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { toggleReaction } from "@/app/actions/social";
import type { FeedItem } from "@/lib/data/social";
import type { ReactionEmoji } from "@/lib/database.types";
import { getTier } from "@/lib/rank/tiers";
import { Avatar } from "@/components/ui/avatar";
import { RankEmblem } from "@/components/rank/rank-emblem";
import { cn } from "@/lib/utils";

function relative(iso: string, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (s < 60) return "ahora";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

function Line({ item }: { item: FeedItem }) {
  const p = item.payload;
  switch (item.kind) {
    case "day_complete":
      return <>ha cerrado el día al <b className="text-success">100 %</b> 🎯</>;
    case "achievement":
      return (
        <>
          ha desbloqueado <b>{String(p.emoji ?? "🏅")} {String(p.name ?? "un logro")}</b>
        </>
      );
    case "rank_up":
      return (
        <>
          ha subido a <b className="text-primary">{getTier(Number(p.to)).name}</b>
        </>
      );
    case "duel_accepted":
      return (
        <>
          y <b>{item.opponent?.name ?? "alguien"}</b> se enfrentan en un duelo esta semana ⚔️
        </>
      );
    case "joined":
      return <>se ha unido al grupo 👋</>;
  }
}

const ICON = {
  day_complete: <Target className="size-3.5" />,
  achievement: <Trophy className="size-3.5" />,
  rank_up: <Flame className="size-3.5" />,
  duel_accepted: <Swords className="size-3.5" />,
  joined: <UserPlus className="size-3.5" />,
} as const;

type Action = { id: number; emoji: ReactionEmoji; on: boolean };

/**
 * Feed en directo: los eventos los genera la BD (no se pueden falsear). Se
 * refresca solo cuando alguien del grupo hace algo, y las reacciones son
 * optimistas (se ven al instante).
 */
export function ActivityFeed({ groupId, items, nowMs }: { groupId: string; items: FeedItem[]; nowMs: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [live, setLive] = useState(false);
  const [mountedAt] = useState(nowMs);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [optimistic, apply] = useOptimistic(items, (state: FeedItem[], a: Action) =>
    state.map((it) =>
      it.id !== a.id
        ? it
        : {
            ...it,
            reactions: it.reactions.map((r) => (r.emoji === a.emoji ? { ...r, mine: a.on, count: Math.max(0, r.count + (a.on ? 1 : -1)) } : r)),
          },
    ),
  );

  useEffect(() => {
    const supabase = getBrowserClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 700);
    };
    const channel = supabase
      .channel(`group-feed-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_activity", filter: `group_id=eq.${groupId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_reactions", filter: `group_id=eq.${groupId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "duels", filter: `group_id=eq.${groupId}` }, refresh)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [groupId, router]);

  const react = (id: number, emoji: ReactionEmoji, on: boolean) =>
    startTransition(async () => {
      apply({ id, emoji, on });
      if (on && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
      const res = await toggleReaction({ activityId: id, emoji, on });
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });

  return (
    <section className="grid gap-3" aria-labelledby="feed-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="feed-title" className="text-base font-semibold">
          Actividad
        </h2>
        {live ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success" role="status">
            <span className="size-2 animate-pulse rounded-full bg-success" aria-hidden="true" />
            En directo
          </span>
        ) : null}
      </div>
      {optimistic.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
          Aún no hay actividad. Cierra tu día al 100 % y serás el primero en aparecer aquí.
        </p>
      ) : (
        <ol className="grid gap-2">
          {optimistic.map((it) => {
            const fresh = new Date(it.createdAt).getTime() > mountedAt - 5_000;
            return (
              <li
                key={it.id}
                className={cn(
                  "feed-item grid gap-2 rounded-2xl border border-border bg-surface p-3 shadow-card",
                  it.kind === "rank_up" && "border-primary/40 bg-primary-soft/40",
                  fresh && "feed-item-new",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar name={it.user.name} emoji={it.user.emoji} color={it.user.color} size="sm" />
                    <span className="absolute -right-1 -bottom-1 grid size-4.5 place-items-center rounded-full bg-surface text-muted ring-1 ring-border" aria-hidden="true">
                      {ICON[it.kind]}
                    </span>
                  </div>
                  <p className="min-w-0 flex-1 text-sm leading-snug">
                    <b>{it.user.name}</b> <Line item={it} />
                    <span className="block text-xs text-muted">{relative(it.createdAt, nowMs)}</span>
                  </p>
                  {it.kind === "rank_up" ? <RankEmblem tierIndex={Number(it.payload.to)} size={36} /> : null}
                </div>
                <div className="flex flex-wrap gap-1.5 pl-11">
                  {it.reactions.map((r) => (
                    <button
                      key={r.emoji}
                      type="button"
                      aria-pressed={r.mine}
                      aria-label={`${r.mine ? "Quitar" : "Reaccionar con"} ${r.emoji}${r.count ? ` (${r.count})` : ""}`}
                      onClick={() => react(it.id, r.emoji, !r.mine)}
                      className={cn(
                        "reaction inline-flex h-8 min-w-10 items-center justify-center gap-1 rounded-full border px-2 text-sm transition-[transform,background-color] active:scale-90",
                        r.mine ? "border-primary/50 bg-primary-soft text-primary" : "border-border bg-surface-2 text-muted hover:text-foreground",
                        r.count === 0 && !r.mine && "opacity-60 hover:opacity-100",
                      )}
                    >
                      <span aria-hidden="true">{r.emoji}</span>
                      {r.count ? <span className="tabular text-xs font-semibold">{r.count}</span> : null}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
