import { FAMILY_COLORS, getTier } from "@/lib/rank/tiers";
import { cn } from "@/lib/utils";

const ROMAN = { 1: "I", 2: "II", 3: "III" } as const;

/**
 * Emblema de rango: escudo facetado con el degradado de la familia y la
 * división en números romanos. Leyenda usa una corona. Sin rango → escudo vacío.
 */
export function RankEmblem({ tierIndex, size = 56, className }: { tierIndex: number | null; size?: number; className?: string }) {
  if (tierIndex === null) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" className={cn("shrink-0 text-border", className)} aria-hidden="true">
        <path d="M32 3 57 13v19c0 15-11 25-25 29C18 57 7 47 7 32V13Z" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="5 4" />
      </svg>
    );
  }
  const tier = getTier(tierIndex);
  const { from, to } = FAMILY_COLORS[tier.family];
  const id = `rank-grad-${tier.family}`;
  const legend = tier.family === "legend";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn("shrink-0 drop-shadow-sm", className)} role="img" aria-label={tier.name}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <path d="M32 3 57 13v19c0 15-11 25-25 29C18 57 7 47 7 32V13Z" fill={`url(#${id})`} />
      <path d="M32 3 57 13v19c0 15-11 25-25 29Z" fill="#000" opacity="0.12" />
      <path d="M32 9 51 17v15c0 11-8 19-19 23-11-4-19-12-19-23V17Z" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.5" />
      {legend ? (
        <path d="m18 40 3-17 7 8 4-11 4 11 7-8 3 17Z" fill="#fff" fillOpacity="0.92" />
      ) : (
        <text
          x="32"
          y="39"
          textAnchor="middle"
          fontSize={tier.division === 3 ? 17 : 19}
          fontWeight="800"
          fill="#fff"
          stroke="#000"
          strokeOpacity="0.25"
          strokeWidth="0.75"
          style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif", letterSpacing: "0.04em" }}
        >
          {ROMAN[tier.division!]}
        </text>
      )}
    </svg>
  );
}
