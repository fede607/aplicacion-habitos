import { cn } from "@/lib/utils";

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <svg viewBox="0 0 64 64" className="size-8" aria-hidden="true">
        <defs>
          <linearGradient id="wa-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7dd3fc" />
            <stop offset="1" stopColor="#0284c7" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="#060a12" />
        <path d="M10 46 L26 22 L34 34 L40 26 L54 46 Z" fill="url(#wa-logo)" />
        <path d="M26 22 L30 28 L27 30 L23 27 Z" fill="#e6f6ff" />
        <path d="M14 18 A22 22 0 0 1 50 18" fill="none" stroke="#fb923c" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
      {withText ? <span className="text-lg">Winter Arc</span> : null}
    </span>
  );
}
