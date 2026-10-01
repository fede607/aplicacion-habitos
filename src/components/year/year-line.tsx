"use client";

import { useRef, useState } from "react";
import { linePath, type YearLine } from "@/lib/year-line";
import { ShareYearButton } from "./share-year-button";

const W = 600;
const H = 180;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Tu año en una línea: constancia (media de 7 días) día a día, con lectura al pasar el dedo. */
export function YearLineCard({ data }: { data: YearLine }) {
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const pts = data.points;
  const n = pts.length;
  const xAt = (i: number) => (n > 1 ? (i / (n - 1)) * W : W / 2);
  const yAt = (v: number) => H - (v / 100) * H;
  const path = linePath(pts, W, H);
  const lastIdx = pts.findLastIndex((p) => p.value !== null);
  const area = n > 1 && path ? `${path} L${xAt(lastIdx).toFixed(1)} ${H} L0 ${H} Z` : "";
  const monthTicks = pts.map((p, i) => ({ p, i })).filter(({ p, i }) => p.date.endsWith("-01") || i === 0);
  const shown = hover ?? lastIdx;
  const hp = shown >= 0 ? pts[shown] : null;

  const pick = (clientX: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r || n === 0) return;
    const i = Math.round(((clientX - r.left) / r.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <section aria-labelledby="line-title" className="grid gap-3 rounded-3xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="line-title" className="text-lg font-black tracking-tight">
            Tu {data.year} en una línea
          </h2>
          <p className="text-xs text-muted">Constancia diaria · media de 7 días</p>
        </div>
        <ShareYearButton />
      </div>

      <div className="flex items-baseline gap-3">
        <p className="text-4xl font-black tabular-nums">{data.current !== null ? `${data.current}%` : "—"}</p>
        {data.delta30 !== null ? (
          <p className={`text-sm font-semibold ${data.delta30 >= 0 ? "text-success" : "text-danger"}`}>
            {data.delta30 >= 0 ? "▲" : "▼"} {Math.abs(data.delta30)} pts vs hace 30 días
          </p>
        ) : null}
      </div>

      {n < 2 ? (
        <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">Marca tus hábitos un par de días y aquí verás crecer tu línea.</p>
      ) : (
        <div className="grid grid-cols-[auto_1fr] gap-x-2">
          <div className="flex h-44 flex-col justify-between text-right text-[10px] text-muted tabular-nums" aria-hidden="true">
            <span>100%</span>
            <span>50%</span>
            <span>0%</span>
          </div>
          <div
            ref={boxRef}
            className="relative h-44 touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-primary"
            role="img"
            tabIndex={0}
            aria-label={`Constancia de ${data.year}: hoy ${data.current ?? 0}%. ${data.perfectDays} días perfectos.${data.best ? ` Mejor punto: ${data.best.value}% el ${fmtDate(data.best.date)}.` : ""}`}
            onPointerMove={(e) => pick(e.clientX)}
            onPointerDown={(e) => pick(e.clientX)}
            onPointerLeave={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? lastIdx) - 1));
              if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? lastIdx) + 1));
            }}
          >
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
              {[0, 50, 100].map((v) => (
                <line key={v} x1={0} x2={W} y1={yAt(v)} y2={yAt(v)} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ))}
              <path d={area} fill="var(--primary)" opacity={0.1} />
              <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {hp && hover !== null ? <line x1={xAt(shown)} x2={xAt(shown)} y1={0} y2={H} stroke="var(--muted)" strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
            </svg>
            {hp && hp.value !== null ? (
              <span
                className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-primary"
                style={{ left: `${(xAt(shown) / W) * 100}%`, top: `${(yAt(hp.value) / H) * 100}%` }}
                aria-hidden="true"
              />
            ) : null}
            {hp && hover !== null ? (
              <div
                className="pointer-events-none absolute top-1 z-10 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-xs shadow-card"
                style={{ left: `clamp(0px, calc(${(xAt(shown) / W) * 100}% - 3rem), calc(100% - 6rem))` }}
              >
                <b className="text-sm tabular-nums">{hp.value !== null ? `${hp.value}%` : "—"}</b>
                <span className="ml-1.5 text-muted">{fmtDate(hp.date)}</span>
              </div>
            ) : null}
          </div>
          <span />
          <div className="relative mt-1 h-4 text-[10px] text-muted" aria-hidden="true">
            {monthTicks.map(({ p, i }) => (
              <span
                key={p.date}
                className={`absolute ${i === 0 ? "" : i / (n - 1) > 0.92 ? "-translate-x-full" : "-translate-x-1/2"}`}
                style={{ left: `${(i / (n - 1)) * 100}%` }}
              >
                {MONTHS[Number(p.date.slice(5, 7)) - 1]}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-muted">
        <b className="text-foreground">{data.perfectDays}</b> {data.perfectDays === 1 ? "día perfecto" : "días perfectos"} este año
        {data.best ? (
          <>
            {" "}
            · mejor semana: <b className="text-foreground">{data.best.value}%</b>
          </>
        ) : null}
      </p>
    </section>
  );
}
