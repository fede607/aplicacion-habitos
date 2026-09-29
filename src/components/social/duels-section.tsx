import { Swords, Trophy } from "lucide-react";
import type { DuelView, MiniProfile } from "@/lib/data/social";
import type { DuelSide } from "@/lib/rank/duel";
import { addDays, formatShortDate } from "@/lib/dates";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DuelResponse } from "./duel-actions";

const fmt = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`);

function Fighter({ p, side, winning, align }: { p: MiniProfile; side: DuelSide | null; winning: boolean; align: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <div className="relative">
        <Avatar name={p.name} emoji={p.emoji} color={p.color} size="md" />
        {winning ? (
          <span className="absolute -top-1.5 -right-1 text-sm" aria-hidden="true">
            👑
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{p.name}</p>
        <p className={cn("tabular text-lg leading-tight font-black", winning ? "text-primary" : "text-muted")}>{fmt(side?.average ?? null)}</p>
        {side ? <p className="text-[11px] text-muted">{side.completeDays} días cumplidos</p> : null}
      </div>
    </div>
  );
}

function DuelCard({ d }: { d: DuelView }) {
  const aWin = d.leader === "a";
  const bWin = d.leader === "b";
  const av = d.a?.average ?? 0;
  const bv = d.b?.average ?? 0;
  const share = av + bv > 0 ? (av / (av + bv)) * 100 : 50;
  const week = `${formatShortDate(d.weekStart)} – ${formatShortDate(addDays(d.weekStart, 6))}`;

  return (
    <li className={cn("grid gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card", d.mine && d.status === "accepted" && "border-primary/40")}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Swords className="size-3.5" aria-hidden="true" /> {week}
        </span>
        {d.status === "pending" ? (
          <Badge tone="warning">{d.mine === "opponent" ? "Te han retado" : "Esperando respuesta"}</Badge>
        ) : d.finished ? (
          <Badge tone="success">
            <Trophy className="size-3" aria-hidden="true" /> {d.leader === "draw" ? "Empate" : `Gana ${d.leader === "a" ? d.challenger.name : d.opponent.name}`}
          </Badge>
        ) : d.started ? (
          <Badge tone="primary">En juego</Badge>
        ) : (
          <Badge>Empieza el lunes</Badge>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Fighter p={d.challenger} side={d.a} winning={d.started && aWin} align="left" />
        <span className="text-xs font-black tracking-widest text-muted">VS</span>
        <Fighter p={d.opponent} side={d.b} winning={d.started && bWin} align="right" />
      </div>

      {d.status === "accepted" && d.started ? (
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${d.challenger.name} ${fmt(d.a?.average ?? null)} contra ${d.opponent.name} ${fmt(d.b?.average ?? null)}`}>
          <div className="duel-bar h-full bg-primary transition-[width] duration-700" style={{ width: `${share}%` }} />
          <div className="h-full flex-1 bg-ember/70" />
        </div>
      ) : null}

      {d.status === "pending" && d.mine ? (
        <div className="flex justify-end">
          <DuelResponse duelId={d.id} mine={d.mine} />
        </div>
      ) : null}
    </li>
  );
}

export function DuelsSection({ duels }: { duels: DuelView[] }) {
  const invites = duels.filter((d) => d.status === "pending" && d.mine === "opponent");
  const others = duels.filter((d) => !(d.status === "pending" && d.mine === "opponent"));
  return (
    <section className="grid gap-3" aria-labelledby="duels-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="duels-title" className="flex items-center gap-2 text-base font-semibold">
          <Swords className="size-4" aria-hidden="true" /> Duelos
        </h2>
        {invites.length ? <Badge tone="warning">{invites.length} pendiente{invites.length > 1 ? "s" : ""}</Badge> : null}
      </div>
      {duels.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
          Nadie se ha retado todavía. Entra en el perfil de un compañero y pulsa <b>«Retar a un duelo»</b>.
        </p>
      ) : (
        <ul className="grid gap-3">
          {[...invites, ...others].map((d) => (
            <DuelCard key={d.id} d={d} />
          ))}
        </ul>
      )}
    </section>
  );
}
