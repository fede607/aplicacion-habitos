"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, Swords } from "lucide-react";
import { cancelDuel, createDuel, respondDuel } from "@/app/actions/social";
import { Button } from "@/components/ui/button";

export function DuelResponse({ duelId, mine }: { duelId: string; mine: "challenger" | "opponent" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => ReturnType<typeof cancelDuel>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(ok);
        router.refresh();
      } else toast.error(res.error);
    });

  if (mine === "challenger") {
    return (
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => cancelDuel(duelId), "Reto retirado")}>
        Retirar reto
      </Button>
    );
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => run(() => respondDuel({ duelId, accept: true }), "¡Duelo aceptado! ⚔️")}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Swords aria-hidden="true" />}
        Aceptar
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => respondDuel({ duelId, accept: false }), "Reto rechazado")}>
        Rechazar
      </Button>
    </div>
  );
}

/** Botón «Retar» del perfil de un miembro. */
export function ChallengeButton({ groupId, opponentId, name }: { groupId: string; opponentId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const send = (week: "this" | "next") =>
    start(async () => {
      const res = await createDuel({ groupId, opponentId, week });
      if (res.ok) {
        toast.success(`Reto enviado a ${name} ⚔️`);
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Swords aria-hidden="true" /> Retar a un duelo
      </Button>
    );
  }
  return (
    <div className="grid gap-2 rounded-2xl border border-border bg-surface-2 p-3">
      <p className="text-sm">
        Gana quien tenga mejor <b>% diario</b> de media en la semana (mismo cálculo que el rango).
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => send("this")}>
          Esta semana
        </Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => send("next")}>
          La próxima semana
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
