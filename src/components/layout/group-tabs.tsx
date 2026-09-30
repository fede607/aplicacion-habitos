"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { LoaderCircle, Users } from "lucide-react";
import { setActiveGroup } from "@/app/actions/groups";
import { cn } from "@/lib/utils";

/** Pestañas visibles para cambiar de grupo (sólo si perteneces a más de uno). */
export function GroupTabs({
  groups,
  activeId,
}: {
  groups: { id: string; name: string }[];
  activeId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  if (groups.length < 2) return null;
  return (
    <nav
      aria-label="Tus grupos"
      className="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
    >
      <ul className="flex w-max gap-2">
        {groups.map((g) => {
          const active = g.id === activeId;
          return (
            <li key={g.id}>
              <button
                type="button"
                aria-pressed={active}
                disabled={pending || active}
                onClick={() =>
                  startTransition(async () => {
                    const res = await setActiveGroup(g.id);
                    if (!res.ok) toast.error(res.error);
                  })
                }
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors",
                  active
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-60",
                )}
              >
                {pending && !active ? (
                  <LoaderCircle
                    className="size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Users className="size-3.5" aria-hidden="true" />
                )}
                {g.name}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
