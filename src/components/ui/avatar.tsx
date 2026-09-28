import { cn } from "@/lib/utils";

export function Avatar({
  name,
  emoji,
  color,
  size = "md",
  className,
}: {
  name: string;
  emoji: string | null;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
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
}
