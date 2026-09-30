"use client";

import { Info } from "lucide-react";
import { RANK_CONFIG, RANK_WEIGHTS, type RankComponent, type RankComponents } from "@/lib/rank/engine";
import { LEGEND_MIN, TIERS } from "@/lib/rank/tiers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

const pct = (n: number) => `${Math.round(n * 100)} %`;
const num = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

export const COMPONENT_INFO: Record<RankComponent, { label: string; text: string }> = {
  consistency: {
    label: "Constancia",
    text: `Proporción de días cumplidos (≥ umbral del grupo) en tus últimos ${RANK_CONFIG.consistencyWindow} días puntuados. Los días más recientes pesan más y los días a medias (≥ ${RANK_CONFIG.partialMin} %) suman un poco.`,
  },
  completion: {
    label: "Cumplimiento",
    text: `Media móvil de tu % diario ponderado por la dificultad de cada hábito. Mide la tendencia, no un día suelto.`,
  },
  difficulty: {
    label: "Hábitos exigentes",
    text: `Igual que el cumplimiento, pero sólo con los hábitos de peso ≥ ${num(RANK_CONFIG.hardWeight)}. Completar lo fácil no sube este apartado.`,
  },
  recent: {
    label: "Rendimiento reciente",
    text: `Media de tus últimos ${RANK_CONFIG.recentWindow} días puntuados.`,
  },
  streak: {
    label: "Racha",
    text: `Días cumplidos seguidos, con rendimiento decreciente: la racha ayuda, pero nunca decide el rango por sí sola.`,
  },
  progress: {
    label: "Progreso y recuperación",
    text: `Compara tu última semana con las dos anteriores: recuperarte tras fallar suma. Mantener un nivel excelente también cuenta.`,
  },
};

export function RankExplainer({ components, demandFactor, threshold }: { components: RankComponents | null; demandFactor: number; threshold: number }) {
  const order = (Object.keys(RANK_WEIGHTS) as RankComponent[]).sort((a, b) => RANK_WEIGHTS[b] - RANK_WEIGHTS[a]);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted">
          <Info aria-hidden="true" /> ¿Cómo se calcula mi rango?
        </Button>
      </DialogTrigger>
      <DialogContent title="¿Cómo se calcula tu rango?" description="Estos son los números reales que usa el algoritmo.">
        <div className="grid gap-5 text-sm">
          <section className="grid gap-2">
            <h3 className="font-semibold">Score de disciplina (0–100)</h3>
            <ul className="grid gap-2">
              {order.map((k) => (
                <li key={k} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">
                      {pct(RANK_WEIGHTS[k])} · {COMPONENT_INFO[k].label}
                    </span>
                    {components ? <span className="tabular text-xs text-muted">tú: {num(components[k])}</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">{COMPONENT_INFO[k].text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-1.5">
            <h3 className="font-semibold">Tu día</h3>
            <p className="text-muted">
              Cada día: hábitos hechos ÷ hábitos previstos, ponderados por su peso (normal ×1, exigente ×1,5, clave ×2). Más hábitos no
              suben la nota: cuenta la proporción. Un día cumplido es ≥ {threshold} %. Los objetivos semanales se miden por semanas.
            </p>
          </section>

          <section className="grid gap-1.5">
            <h3 className="font-semibold">Protecciones</h3>
            <ul className="grid list-disc gap-1 pl-5 text-muted">
              <li>
                Suavizado: tu score sube como máximo {num(RANK_CONFIG.maxDailyRise)} puntos al día y baja como máximo {num(RANK_CONFIG.maxDailyDrop)}. Nunca
                cambias más de una división en un día.
              </li>
              <li>Tu score nunca baja del {pct(RANK_CONFIG.peakFloorRatio)} de tu mejor marca.</li>
              <li>Los días de descanso programados no cuentan: no bajan el score ni rompen la racha. Hoy sólo cuenta si te ayuda.</li>
              <li>
                «No aplica» es neutro hasta el {pct(RANK_CONFIG.skipAllowance)} de lo programado en {RANK_CONFIG.skipWindow} días; el exceso cuenta como no hecho.
              </li>
              <li>Registrar días pasados con más de {RANK_CONFIG.lateAfterDays} día de retraso vale el {pct(RANK_CONFIG.lateLogFactor)}.</li>
              <li>Si el admin cambia un hábito, el cambio se aplica desde mañana: tu pasado no se recalcula.</li>
              <li>
                Rutinas muy pequeñas (menos de {RANK_CONFIG.demandFullLoad} puntos de peso al día) se multiplican por hasta ×{num(RANK_CONFIG.demandMinFactor)}.
                {demandFactor < 1 ? ` Tu factor actual: ×${num(demandFactor)}.` : ""}
              </li>
            </ul>
          </section>

          <section className="grid gap-1.5">
            <h3 className="font-semibold">Confianza</h3>
            <p className="text-muted">
              Días 1–3: provisional · 4–7: estimado · 8–{RANK_CONFIG.fullConfidenceDays - 1}: estabilizándose · {RANK_CONFIG.fullConfidenceDays}+: estable. Con pocos
              días tu score se acerca a {RANK_CONFIG.prior} puntos y se va separando a medida que hay datos.
            </p>
          </section>

          <section className="grid gap-1.5">
            <h3 className="font-semibold">Rangos</h3>
            <p className="text-muted">
              {TIERS.length - 1} divisiones de Hierro I a Élite III (desde {TIERS[1].min} hasta {TIERS[TIERS.length - 2].min} puntos) y Leyenda: ≥ {LEGEND_MIN}{" "}
              puntos, al menos {RANK_CONFIG.legendMinDays} días puntuados y una constancia ≥ {RANK_CONFIG.legendMinConsistency}.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
