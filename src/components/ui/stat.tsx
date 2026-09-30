import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "ember" | "primary" | "success";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-4 shadow-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs font-medium tracking-wide text-muted uppercase">
        <span>{label}</span>
        {icon ? (
          <span
            className={cn(
              "[&_svg]:size-4",
              tone === "ember" && "text-ember",
              tone === "primary" && "text-primary",
              tone === "success" && "text-success",
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="tabular mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}
