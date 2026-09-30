"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setActiveGroup } from "@/app/actions/groups";
import { Select } from "@/components/ui/input";

export function GroupSwitcher({
  groups,
  activeId,
}: {
  groups: { id: string; name: string }[];
  activeId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  if (groups.length < 2) return null;
  return (
    <div className="relative">
      <label htmlFor="group-switcher" className="sr-only">
        Grupo activo
      </label>
      <Select
        id="group-switcher"
        value={activeId ?? ""}
        disabled={pending}
        className="h-9 max-w-44 truncate text-sm sm:max-w-56"
        onChange={(e) => {
          const id = e.target.value;
          startTransition(async () => {
            const res = await setActiveGroup(id);
            if (!res.ok) toast.error(res.error);
          });
        }}
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
