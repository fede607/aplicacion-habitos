import { cn } from "@/lib/utils";

export function Avatar({
  name,
  emoji,
  color,
  size = "md",
  pro = false,
  className,
}: {
  name: string;
  emoji: string | null;
  color: string;
  size?: "sm" | "md" | "lg";
  /** Marco Pro exclusivo (anillo degradado). */
  pro?: boolean;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const inner = (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-surface select-none",
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-16 text-xl",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {emoji ? <span className={size === "lg" ? "text-3xl" : "text-lg"}>{emoji}</span> : initials || "?"}
    </span>
  );
  if (!pro) return inner;
  return (
    <span aria-hidden="true" className="pro-gradient inline-grid shrink-0 place-items-center rounded-full p-[2px]">
      {inner}
    </span>
  );
}
