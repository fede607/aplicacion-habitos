"use client";

import { useState } from "react";
import { formatShortDate } from "@/lib/dates";
import { getTier, TIERS } from "@/lib/rank/tiers";

export type RankChartPoint = { date: string; score: number; tierIndex: number };

const W = 640;
const H = 200;
const PAD = { top: 10, right: 8, bottom: 8, left: 28 };

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

/**
 * Evolución del score de disciplina (una sola serie, sin leyenda). Las líneas
 * de fondo marcan el inicio de cada rango. Crosshair + tooltip al pasar el
 * cursor o el dedo; tabla equivalente para lectores de pantalla.
 */
export function RankHistoryChart({ points }: { points: RankChartPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) {
    return <p className="text-sm text-muted">La evolución aparecerá cuando tengas al menos dos días puntuados.</p>;
  }
  const scores = points.map((p) => p.score);
  const lo = Math.max(0, Math.floor((Math.min(...scores) - 6) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...scores) + 6) / 10) * 10);
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  const bands = TIERS.filter((t) => t.division === 1 || t.division === null).filter((t) => t.min > lo && t.min < hi);
  const active = hover === null ? null : points[hover];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  return (
    <figure className="grid gap-2">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-48 w-full touch-pan-y sm:h-56"
          preserveAspectRatio="none"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          aria-hidden="true"
        >
          {bands.map((t) => (
            <line key={t.index} x1={PAD.left} x2={W - PAD.right} y1={y(t.min)} y2={y(t.min)} className="stroke-border" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={path} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {active && hover !== null ? (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-muted" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ) : null}
        </svg>
        {bands.map((t) => (
          <span
            key={t.index}
            className="tabular pointer-events-none absolute left-0 -translate-y-1/2 text-[10px] text-muted"
            style={{ top: `${(y(t.min) / H) * 100}%` }}
            title={getTier(t.index).name}
          >
            {t.min}
          </span>
        ))}
        {active && hover !== null ? (
          <>
            <span
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-primary"
              style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(active.score) / H) * 100}%` }}
            />
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-card"
              style={{ left: `${Math.min(85, Math.max(15, (x(hover) / W) * 100))}%` }}
            >
              <p className="text-muted">{formatShortDate(active.date)}</p>
              <p className="tabular font-semibold text-foreground">
                {fmt(active.score)} · {getTier(active.tierIndex).name}
              </p>
            </div>
          </>
        ) : null}
      </div>
      <div className="flex justify-between pl-7 text-[10px] text-muted" aria-hidden="true">
        <span>{formatShortDate(points[0].date)}</span>
        <span>{formatShortDate(points[points.length - 1].date)}</span>
      </div>
      <figcaption className="text-xs text-muted">Score de disciplina día a día. Las líneas discontinuas marcan dónde empieza cada rango.</figcaption>
      <table className="sr-only">
        <caption>Evolución del score de disciplina</caption>
        <thead>
          <tr>
            <th>Día</th>
            <th>Score</th>
            <th>Rango</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{formatShortDate(p.date)}</td>
              <td>{fmt(p.score)}</td>
              <td>{getTier(p.tierIndex).name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
