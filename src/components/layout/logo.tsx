import { cn } from "@/lib/utils";

export function Logo({
  className,
  withText = true,
}: {
  className?: string;
  withText?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-bold tracking-tight",
        className,
      )}
    >
      <svg viewBox="0 0 64 64" className="size-8" aria-hidden="true">
        <rect
          width="64"
          height="64"
          rx="16"
          fill="#060a12"
          stroke="#1e293b"
          strokeWidth="2"
        />
        <path d="M10 46 L26 22 L34 34 L40 26 L54 46 Z" fill="#38bdf8" />
        <path d="M26 22 L30 28 L27 30 L23 27 Z" fill="#e6f6ff" />
        <path
          d="M14 18 A22 22 0 0 1 50 18"
          fill="none"
          stroke="#fb923c"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
      {withText ? <span className="text-lg">Year Arc</span> : null}
    </span>
  );
}
