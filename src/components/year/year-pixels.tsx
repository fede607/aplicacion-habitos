import { MONTH_SHORT, PIXEL_COLORS, type YearPixels } from "@/lib/year-pixels";
import { ShareYearButton } from "./share-year-button";

const LEGEND: { key: string; label: string }[] = [
  { key: "0", label: "0 %" },
  { key: "1", label: "" },
  { key: "2", label: "" },
  { key: "3", label: "" },
  { key: "4", label: "100 %" },
];

/** Tu año en píxeles: 12 filas (meses) × hasta 31 cuadrados (días). */
export function YearPixelsCard({ data, today }: { data: YearPixels; today: string }) {
  return (
    <section aria-labelledby="year-title" className="grid gap-4 rounded-3xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="year-title" className="text-lg font-black tracking-tight">
            Tu {data.year} en píxeles
          </h2>
          <p className="text-sm text-muted">
            <b className="text-foreground">{data.perfectDays}</b> {data.perfectDays === 1 ? "día perfecto" : "días perfectos"}
            {data.bestMonth !== null ? (
              <>
                {" "}
                · mejor mes: <b className="text-foreground">{MONTH_SHORT[data.bestMonth]}</b>
              </>
            ) : null}
          </p>
        </div>
        <ShareYearButton />
      </div>

      <div className="grid gap-[3px]" role="img" aria-label={`Mapa del año ${data.year}: ${data.perfectDays} días perfectos de ${data.trackedDays} registrados`}>
        {data.months.map((days, m) => (
          <div key={m} className="grid items-center gap-[3px]" style={{ gridTemplateColumns: "1.75rem repeat(31, minmax(0, 1fr))" }}>
            <span className="text-[10px] font-semibold text-muted">{MONTH_SHORT[m]}</span>
            {days.map((p) => (
              <span
                key={p.date}
                title={`${p.date}${p.percent !== null ? ` · ${p.percent}%` : ""}`}
                className={`aspect-square rounded-[3px] ${p.date === today ? "ring-2 ring-foreground ring-offset-1 ring-offset-surface" : ""}`}
                style={{ backgroundColor: PIXEL_COLORS[String(p.level)] }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted" aria-hidden="true">
        {LEGEND.map((l) => (
          <span key={l.key} className="flex items-center gap-1">
            {l.label && l.key === "4" ? null : l.label}
            <span className="size-3 rounded-[3px]" style={{ backgroundColor: PIXEL_COLORS[l.key] }} />
            {l.label && l.key === "4" ? l.label : null}
          </span>
        ))}
      </div>
    </section>
  );
}
