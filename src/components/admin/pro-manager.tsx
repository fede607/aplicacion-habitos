"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { formatDateOnly } from "@/lib/dates";
import { grantManualPro } from "@/app/actions/billing";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ProMember = {
  userId: string;
  name: string;
  emoji: string | null;
  color: string;
  active: boolean;
  proUntil: string | null;
};

export function ProManager({ groupId, members, meId, timeZone }: { groupId: string; members: ProMember[]; meId: string; timeZone: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (m: ProMember, months: number) => {
    if (months === 0 && !window.confirm(`¿Quitar el Pro a ${m.name}?`)) return;
    startTransition(async () => {
      const res = await grantManualPro({ groupId, userId: m.userId, months });
      if (res.ok) {
        toast.success(months === 0 ? `${m.name} ya no es Pro` : `${m.name}: +${months} mes de Pro`);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  return (
    <ul className="grid gap-2">
      {members
        .filter((m) => m.userId !== meId)
        .map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3">
            <Avatar name={m.name} emoji={m.emoji} color={m.color} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{m.name}</p>
              <p className="text-xs text-muted">
                {m.active && m.proUntil ? `Pro hasta el ${formatDateOnly(m.proUntil, timeZone)}` : "Sólo hábitos"}
              </p>
            </div>
            {m.active ? <Badge tone="success">Pro</Badge> : null}
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" disabled={pending} onClick={() => run(m, 1)}>
                <Sparkles aria-hidden="true" /> +1 mes
              </Button>
              {m.active ? (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(m, 0)}>
                  Quitar
                </Button>
              ) : null}
            </div>
          </li>
        ))}
    </ul>
  );
}
