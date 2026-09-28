import { dayPercent, isGoodDay, type DayStat } from "@/lib/stats";
import { formatShortDate, formatWeekdayShort } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Barras de cumplimiento diario (una sola serie: no necesita leyenda). Cada barra
 * tiene tooltip nativo + etiqueta accesible, y hay una tabla equivalente para
 * lectores de pantalla.
 */
export function RecentDaysChart({ days, threshold }: { days: DayStat[]; threshold: number }) {
  return (
    <figure className="grid gap-2">
      <div className="flex h-32 items-end gap-[2px]" aria-hidden="true">
        {days.map((d) => {
          const pct = dayPercent(d);
          const good = isGoodDay(d, threshold);
          return (
            <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${formatShortDate(d.day)}: ${pct === null ? "descanso" : `${pct}%`}`}>
              <div
                className={cn(
                  "w-full rounded-t-[4px] transition-colors",
                  pct === null ? "bg-surface-2" : good ? "bg-primary" : "bg-primary/35",
                  "group-hover:brightness-125",
                )}
                style={{ height: pct === null ? "4px" : `${Math.max(pct, 4)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-[2px] text-[10px] text-muted" aria-hidden="true">
        {days.map((d, i) => (
          <span key={d.day} className="flex-1 text-center capitalize">
            {i % 2 === days.length % 2 ? formatWeekdayShort(d.day).slice(0, 2) : ""}
          </span>
        ))}
      </div>
      <figcaption className="text-xs text-muted">
        Barras llenas: días cumplidos (≥ {threshold}%). Gris: día de descanso.
      </figcaption>
      <table className="sr-only">
        <caption>Cumplimiento de los últimos {days.length} días</caption>
        <thead>
          <tr>
            <th>Día</th>
            <th>Cumplimiento</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td>{formatShortDate(d.day)}</td>
              <td>{dayPercent(d) === null ? "Descanso" : `${d.completed} de ${d.required} (${dayPercent(d)}%)`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
