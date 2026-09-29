"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getTier } from "@/lib/rank/tiers";
import { RankEmblem } from "./rank-emblem";

function storageKey(groupId: string, today: string, to: number) {
  return `wa-rank-seen:${groupId}:${today}:${to}`;
}

/**
 * Aviso de cambio de división respecto a la última vez que viste tu rango.
 * Subida: celebración breve. Bajada: mensaje neutro, sin dramatismo.
 */
export function RankChange({ groupId, today, from, to }: { groupId: string; today: string; from: number; to: number }) {
  const [open, setOpen] = useState(false);
  const up = to > from;

  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(storageKey(groupId, today, to)) === "1";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sólo tras leer localStorage en cliente
    if (!seen) setOpen(true);
  }, [groupId, today, to]);

  if (!open || from === to) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey(groupId, today, to), "1");
    } catch {}
    setOpen(false);
  };

  return (
    <div
      role="status"
      className={
        up
          ? "rank-up relative overflow-hidden rounded-2xl border border-primary/40 bg-primary-soft p-4 shadow-card"
          : "relative rounded-2xl border border-border bg-surface p-4 shadow-card"
      }
    >
      <button type="button" onClick={dismiss} aria-label="Cerrar" className="absolute top-2 right-2 inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground">
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-4 pr-8">
        <RankEmblem tierIndex={to} size={52} className={up ? "rank-up-emblem" : undefined} />
        <div className="min-w-0">
          <p className={up ? "text-xs font-bold tracking-[0.2em] text-primary uppercase" : "text-xs font-semibold tracking-widest text-muted uppercase"}>
            {up ? "Rank up" : "Tu rango ha cambiado"}
          </p>
          <p className="text-lg font-bold tracking-tight">
            {getTier(from).name} <span className="text-muted">→</span> {getTier(to).name}
          </p>
          <p className="text-sm text-muted">
            {up ? "Tu constancia está dando resultado. Sigue así." : "Tu constancia reciente ha bajado. Sigue adelante para recuperarlo."}
          </p>
        </div>
      </div>
    </div>
  );
}
