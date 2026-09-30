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
  trialUntil: string | null;
};

function status(m: ProMember, timeZone: string, nowMs: number): string {
  if (m.proUntil && new Date(m.proUntil).getTime() > nowMs) return `Pro pagado hasta el ${formatDateOnly(m.proUntil, timeZone)}`;
  if (m.trialUntil && new Date(m.trialUntil).getTime() > nowMs) return `🎁 Mes gratis hasta el ${formatDateOnly(m.trialUntil, timeZone)}`;
  if (m.trialUntil) return "Mes gratis terminado · versión gratis";
  return "Versión gratis";
}

export function ProManager({ groupId, members, meId, timeZone, nowMs }: { groupId: string; members: ProMember[]; meId: string; timeZone: string; nowMs: number }) {
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
                {status(m, timeZone, nowMs)}
              </p>
            </div>
            {m.active ? <Badge tone="success">Pro</Badge> : null}
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" disabled={pending} onClick={() => run(m, 1)}>
                <Sparkles aria-hidden="true" /> +1 mes
              </Button>
              {m.proUntil && new Date(m.proUntil).getTime() > nowMs ? (
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
