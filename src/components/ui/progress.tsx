import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  size = 132,
  stroke = 12,
  className,
  label,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  label: string;
  children?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-2"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
          className={cn(
            "transition-[stroke-dashoffset] duration-500",
            clamped >= 100 ? "stroke-success" : "stroke-primary",
          )}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function ProgressBar({
  value,
  className,
  tone = "primary",
  label,
}: {
  value: number;
  className?: string;
  tone?: "primary" | "ember" | "success";
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-surface-2",
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          tone === "primary" && "bg-primary",
          tone === "ember" && "bg-ember",
          tone === "success" && "bg-success",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
