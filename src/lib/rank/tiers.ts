/**
 * Escalera de rangos de Year Arc: 8 rangos × 3 divisiones + Leyenda.
 * Los umbrales no son lineales: arriba cada división cuesta más.
 * Anchura mínima de división = 2,5 puntos (> MAX_DAILY_RISE), lo que impide
 * cruzar más de una división en un solo día.
 */

export type TierFamily =
  | "iron"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "master"
  | "elite"
  | "legend";

export type Tier = {
  index: number;
  family: TierFamily;
  division: 1 | 2 | 3 | null;
  name: string;
  min: number;
};

export const FAMILY_LABELS: Record<TierFamily, string> = {
  iron: "Hierro",
  bronze: "Bronce",
  silver: "Plata",
  gold: "Oro",
  platinum: "Platino",
  diamond: "Diamante",
  master: "Maestro",
  elite: "Élite",
  legend: "Leyenda",
};

/** Colores del emblema (legibles sobre fondo claro y oscuro). */
export const FAMILY_COLORS: Record<TierFamily, { from: string; to: string }> = {
  iron: { from: "#9ca3af", to: "#4b5563" },
  bronze: { from: "#e0a26b", to: "#9a5423" },
  silver: { from: "#e2e8f0", to: "#8193aa" },
  gold: { from: "#fde047", to: "#ca8a04" },
  platinum: { from: "#99f6e4", to: "#0d9488" },
  diamond: { from: "#bae6fd", to: "#2563eb" },
  master: { from: "#e9d5ff", to: "#7e22ce" },
  elite: { from: "#fecaca", to: "#dc2626" },
  legend: { from: "#fef08a", to: "#f97316" },
};

const ROMAN = ["I", "II", "III"] as const;

const FAMILY_MINS: [Exclude<TierFamily, "legend">, [number, number, number]][] =
  [
    ["iron", [0, 6, 12]],
    ["bronze", [18, 22, 26]],
    ["silver", [30, 34, 38]],
    ["gold", [42, 46, 50]],
    ["platinum", [54, 58, 62]],
    ["diamond", [66, 70, 74]],
    ["master", [78, 81, 84]],
    ["elite", [87, 89.5, 92]],
  ];

export const LEGEND_MIN = 95;

export const TIERS: Tier[] = [
  ...FAMILY_MINS.flatMap(([family, mins]) =>
    mins.map((min, i) => ({
      index: 0,
      family,
      division: (i + 1) as 1 | 2 | 3,
      name: `${FAMILY_LABELS[family]} ${ROMAN[i]}`,
      min,
    })),
  ),
  {
    index: 0,
    family: "legend" as const,
    division: null,
    name: FAMILY_LABELS.legend,
    min: LEGEND_MIN,
  },
].map((t, index) => ({ ...t, index }));

export const LEGEND_INDEX = TIERS.length - 1;
export const MAX_TIER_BELOW_LEGEND = LEGEND_INDEX - 1;

export function tierIndexForScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  let idx = 0;
  for (const t of TIERS) if (score >= t.min) idx = t.index;
  return idx;
}

export function getTier(index: number): Tier {
  return TIERS[Math.max(0, Math.min(LEGEND_INDEX, Math.trunc(index) || 0))];
}

export function nextTier(index: number): Tier | null {
  return index >= LEGEND_INDEX ? null : TIERS[index + 1];
}

/** 0–100: cuánto has avanzado dentro de tu división actual. */
export function progressInTier(score: number, index: number): number {
  const t = getTier(index);
  const n = nextTier(index);
  if (!n) return 100;
  const p = ((score - t.min) / (n.min - t.min)) * 100;
  return Math.max(0, Math.min(100, p));
}
