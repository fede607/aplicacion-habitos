"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Sparkles } from "lucide-react";
import { formatDateOnly } from "@/lib/dates";
import { staffGrantPro } from "@/app/actions/billing";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ProMember = {
  userId: string;
  name: string;
  username: string;
  emoji: string | null;
  color: string;
  active: boolean;
  proUntil: string | null;
  trialUntil: string | null;
  lifetime: boolean;
};

function status(m: ProMember, timeZone: string, nowMs: number): string {
  if (m.lifetime) return "⭐ Pro para siempre";
  if (m.proUntil && new Date(m.proUntil).getTime() > nowMs)
    return `Pro pagado hasta el ${formatDateOnly(m.proUntil, timeZone)}`;
  if (m.trialUntil && new Date(m.trialUntil).getTime() > nowMs)
    return `🎁 Mes gratis hasta el ${formatDateOnly(m.trialUntil, timeZone)}`;
  if (m.trialUntil) return "Mes gratis terminado · versión gratis";
  return "Versión gratis";
}

/** Panel del propietario: busca a quien te ha pagado y actívale su mes o año de Pro. */
export function ProManager({
  members,
  timeZone,
  nowMs,
}: {
  members: ProMember[];
  timeZone: string;
  nowMs: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    return q
      ? members.filter(
          (m) =>
            m.username.toLowerCase().includes(q) ||
            m.name.toLowerCase().includes(q),
        )
      : members;
  }, [members, query]);

  const run = (m: ProMember, months: 0 | 1 | 12) => {
    const what =
      months === 0
        ? `¿Quitar el Pro a ${m.name}?`
        : `¿Has recibido ${months === 12 ? "20 € (1 año)" : "2 € (1 mes)"} de ${m.name}?`;
    if (!window.confirm(what)) return;
    startTransition(async () => {
      const res = await staffGrantPro({ userId: m.userId, months });
      if (res.ok) {
        toast.success(
          months === 0
            ? `${m.name} ya no es Pro`
            : `${m.name}: +${months === 12 ? "1 año" : "1 mes"} de Pro`,
        );
        router.refresh();
      } else toast.error(res.error);
    });
  };

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar @usuario o nombre"
          className="pl-9"
          aria-label="Buscar usuario"
        />
      </div>
      <ul className="grid gap-2">
        {shown.map((m) => {
          const paid = !!m.proUntil && new Date(m.proUntil).getTime() > nowMs;
          return (
            <li
              key={m.userId}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3"
            >
              <Avatar name={m.name} emoji={m.emoji} color={m.color} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {m.name}{" "}
                  <span className="font-normal text-muted">@{m.username}</span>
                </p>
                <p className="text-xs text-muted">
                  {status(m, timeZone, nowMs)}
                </p>
              </div>
              {m.active ? <Badge tone="success">Pro</Badge> : null}
              {m.lifetime ? null : (
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => run(m, 1)}
                  >
                    <Sparkles aria-hidden="true" /> +1 mes
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => run(m, 12)}
                  >
                    +1 año
                  </Button>
                  {paid ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => run(m, 0)}
                    >
                      Quitar
                    </Button>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
        {shown.length === 0 ? (
          <li className="p-3 text-sm text-muted">
            Nadie coincide con «{query}».
          </li>
        ) : null}
      </ul>
    </div>
  );
}
