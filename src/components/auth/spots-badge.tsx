import { Flame } from "lucide-react";
import type { SignupSpots } from "@/lib/data/signup-spots";

/** Aviso de plazas limitadas (cifra real, sale de la base de datos). */
export function SpotsBadge({ spots, className = "" }: { spots: SignupSpots | null; className?: string }) {
  if (!spots) return null;
  const taken = spots.total - spots.left;
  const pct = Math.min(100, Math.round((taken / spots.total) * 100));
  return (
    <div role="status" className={`rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm ${className}`}>
      <p className="flex items-center gap-2 font-bold">
        <Flame className="size-4 shrink-0 text-warning" aria-hidden="true" />
        {spots.left > 0 ? (
          <span>
            Sólo {spots.total} plazas · {spots.left === 1 ? "queda 1" : `quedan ${spots.left}`}
          </span>
        ) : (
          <span>Plazas agotadas</span>
        )}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
        <div className="h-full rounded-full bg-warning" style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {spots.left > 0 ? "Cuando se llenen, el registro se cierra. Coge la tuya hoy." : "El registro está cerrado por ahora."}
      </p>
    </div>
  );
}
