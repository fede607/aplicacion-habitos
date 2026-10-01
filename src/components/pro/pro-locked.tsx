import Link from "next/link";
import { Check, Lock, Sparkles } from "lucide-react";
import { PRO_MONTH_EUR, PRO_YEAR_EUR } from "@/lib/billing/paypal-me";

export type ProFeature = "plan" | "workouts" | "dashboard" | "rank" | "progress" | "calendar";

const FEATURES: Record<ProFeature, { title: string; pitch: string; perks: string[]; preview: "list" | "bars" | "grid" | "badge" }> = {
  plan: {
    title: "Tu plan de entreno a medida",
    pitch: "Rutina, series, descansos y calorías calculados para tu cuerpo, tu objetivo y tu material.",
    perks: ["Plan semanal personalizado", "Ejercicios alternativos si tienes molestias", "Ciclos de 4 semanas con descarga"],
    preview: "list",
  },
  workouts: {
    title: "Registro de entrenos",
    pitch: "Apunta cada sesión y mira cómo subes de peso y de minutos semana a semana.",
    perks: ["Historial de todas tus sesiones", "Sesión del plan rellenada sola", "Minutos y sensaciones"],
    preview: "list",
  },
  dashboard: {
    title: "Tu panel de progreso",
    pitch: "Tus números de un vistazo: constancia, rachas y cómo vas este mes frente al anterior.",
    perks: ["Resumen semanal y mensual", "Comparativa con el mes pasado", "Tus mejores y peores días"],
    preview: "bars",
  },
  rank: {
    title: "Tu rango de disciplina",
    pitch: "Sube de Bronce a Leyenda según tu constancia real. Tu nivel, visible en tu perfil.",
    perks: ["Rango que sube y baja contigo", "Historial de tu evolución", "Marco Pro en tu avatar"],
    preview: "badge",
  },
  progress: {
    title: "Logros y estadísticas avanzadas",
    pitch: "Qué hábitos te cuestan más, qué días fallas y todo tu histórico exportable.",
    perks: ["Logros desbloqueables", "Análisis por hábito y día de la semana", "Exportar tus datos"],
    preview: "bars",
  },
  calendar: {
    title: "Calendario completo",
    pitch: "Cada día de tu año con su porcentaje, tus notas y tus entrenos.",
    perks: ["Vista mensual con colores", "Notas y entrenos de cada día", "Todo tu histórico"],
    preview: "grid",
  },
};

/** Contenido de ejemplo, difuminado: deja intuir lo que hay detrás sin mostrar datos reales. */
function Preview({ kind }: { kind: "list" | "bars" | "grid" | "badge" }) {
  if (kind === "bars")
    return (
      <div className="grid gap-4">
        <div className="grid grid-cols-3 gap-3">
          {["87%", "23", "+12"].map((v) => (
            <div key={v} className="rounded-2xl bg-surface-2 p-4 text-center text-2xl font-black">
              {v}
            </div>
          ))}
        </div>
        <div className="flex h-40 items-end gap-2 rounded-2xl bg-surface-2 p-4">
          {[40, 65, 50, 80, 72, 95, 60, 88, 76, 92, 70, 85].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-primary" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    );
  if (kind === "grid")
    return (
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="aspect-square rounded-xl" style={{ backgroundColor: ["#22c55e", "#84cc16", "#f59e0b", "#22c55e", "#c2410c"][i % 5] }} />
        ))}
      </div>
    );
  if (kind === "badge")
    return (
      <div className="grid place-items-center gap-4 py-6">
        <div className="pro-gradient grid size-32 place-items-center rounded-full text-5xl">🏆</div>
        <div className="h-4 w-40 rounded-full bg-surface-2" />
        <div className="h-3 w-full rounded-full bg-surface-2">
          <div className="h-3 w-2/3 rounded-full bg-primary" />
        </div>
      </div>
    );
  return (
    <div className="grid gap-2">
      {["Sentadilla goblet · 4×8", "Press banca · 4×8", "Remo en polea · 3×12", "Peso muerto rumano · 3×10", "Plancha · 3×45 s"].map((t) => (
        <div key={t} className="rounded-2xl bg-surface-2 p-4 font-semibold">
          {t}
        </div>
      ))}
    </div>
  );
}

/** Pantalla Pro bloqueada: vista previa difuminada + promoción del plan Pro. */
export function ProLocked({ feature }: { feature: ProFeature }) {
  const f = FEATURES[feature];
  return (
    <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl">
      <div aria-hidden="true" className="pointer-events-none grid select-none gap-4 p-1 pb-[24rem] blur-[5px] saturate-150">
        <Preview kind={f.preview} />
      </div>

      <div className="absolute inset-x-0 top-24 bottom-0 grid place-items-end justify-items-center bg-gradient-to-b from-transparent via-background/70 to-background p-4">
        <section className="grid w-full max-w-sm gap-4 rounded-3xl border border-primary/40 bg-surface/95 p-6 text-center shadow-2xl backdrop-blur" aria-labelledby="pro-locked-title">
          <span className="pro-gradient mx-auto grid size-14 place-items-center rounded-2xl">
            <Lock className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold tracking-widest text-primary uppercase">Sólo plan Pro</p>
            <h1 id="pro-locked-title" className="mt-1 text-2xl font-black tracking-tight text-balance">
              {f.title}
            </h1>
            <p className="mt-2 text-sm text-muted text-pretty">{f.pitch}</p>
          </div>
          <ul className="grid gap-2 text-left text-sm">
            {f.perks.map((p) => (
              <li key={p} className="flex gap-2">
                <Check className="size-4 shrink-0 text-success" aria-hidden="true" /> {p}
              </li>
            ))}
          </ul>
          <Link href="/pro" className="pro-gradient inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-6 text-base font-bold">
            <Sparkles className="size-5" aria-hidden="true" /> Hazte Pro · {PRO_MONTH_EUR} €/mes
          </Link>
          <p className="text-xs text-muted">o {PRO_YEAR_EUR} €/año (2 meses gratis). Tus hábitos y tu línea del año siguen siendo gratis.</p>
        </section>
      </div>
    </div>
  );
}
