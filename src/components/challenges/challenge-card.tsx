"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Flame } from "lucide-react";
import { abandonChallenge, toggleChallengeDay } from "@/app/actions/challenges";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import type { ChallengeProgress } from "@/lib/challenges";
import { cn } from "@/lib/utils";

export type ChallengeCardData = { id: string; emoji: string; title: string; progress: ChallengeProgress; today: string; yesterday: string };

/** Reto activo: barra de progreso, marcar hoy/ayer y abandonar. */
export function ChallengeCard({ c }: { c: ChallengeCardData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const p = c.progress;

  const toggle = (day: string) =>
    start(async () => {
      const res = await toggleChallengeDay({ challengeId: c.id, day });
      if (!res.ok) return void toast.error(res.error);
      if (res.data.completed) toast.success(`🏅 ¡Reto completado! «${c.title}» ya está en tu vitrina.`);
      router.refresh();
    });

  return (
    <li className="grid gap-3 rounded-3xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl" aria-hidden="true">
          {c.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold break-words">{c.title}</p>
          <p className="text-xs text-muted">
            Día {p.dayNumber} de {p.total} · {p.done}/{p.total} cumplidos
            {p.streak > 1 ? (
              <span className="ml-1 inline-flex items-center gap-0.5 font-semibold text-ember">
                <Flame className="size-3" aria-hidden="true" /> {p.streak} seguidos
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <ProgressBar value={p.percent} label={`${p.percent}% del reto`} />
      {p.expired ? (
        <p className="text-sm text-muted">Se acabó el plazo. ¡Lo has intentado! Empieza otro cuando quieras.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={p.doneToday ? "secondary" : "pro"}
            disabled={pending}
            onClick={() => toggle(c.today)}
            className={cn(p.doneToday && "text-success")}
            aria-pressed={p.doneToday}
          >
            <Check aria-hidden="true" /> {p.doneToday ? "Hecho hoy" : "Marcar hoy"}
          </Button>
          {p.canMarkYesterday ? (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => toggle(c.yesterday)}>
              Lo hice ayer
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-muted"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (!window.confirm(`¿Dejar el reto «${c.title}»?`)) return;
                const res = await abandonChallenge(c.id);
                if (!res.ok) return void toast.error(res.error);
                router.refresh();
              })
            }
          >
            Dejar
          </Button>
        </div>
      )}
    </li>
  );
}
