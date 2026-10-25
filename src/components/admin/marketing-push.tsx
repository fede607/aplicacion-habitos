"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Megaphone, Send } from "lucide-react";
import { staffSendMarketingPush } from "@/app/actions/access";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

/** Staff: aviso de novedades/ofertas sólo a quien lo activó en su perfil (máx. 1 cada 7 días). */
export function MarketingPush({ people, lastSentAt }: { people: number; lastSentAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("🎁 Year Arc Pro");
  const [body, setBody] = useState("Plan de entreno y nutrición personalizados, análisis y medallas. Pruébalo por 2 €/mes.");
  const daysSince = lastSentAt ? Math.floor((Date.parse(new Date().toISOString()) - Date.parse(lastSentAt)) / 86_400_000) : null;
  const blocked = daysSince !== null && daysSince < 7;

  return (
    <div className="grid gap-3">
      <p className="flex items-center gap-2 text-sm">
        <Megaphone className="size-4 text-primary" aria-hidden="true" />
        Llegaría a <b>{people}</b> {people === 1 ? "persona" : "personas"} (las que activaron «Novedades y ofertas» y tienen avisos).
      </p>
      <Field label="Título" htmlFor="mk-title">
        <Input id="mk-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
      </Field>
      <Field label="Mensaje" htmlFor="mk-body" hint={`${body.length}/160`}>
        <Input id="mk-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={160} />
      </Field>
      <Button
        className="justify-self-start"
        disabled={pending || blocked || people === 0}
        onClick={() =>
          start(async () => {
            if (!window.confirm(`¿Enviar este aviso a ${people} ${people === 1 ? "persona" : "personas"}? No podrás enviar otro en 7 días.`)) return;
            const res = await staffSendMarketingPush({ title, body });
            if (!res.ok) return void toast.error(res.error);
            toast.success(`Aviso enviado a ${res.data.people} ${res.data.people === 1 ? "persona" : "personas"} (${res.data.delivered} dispositivos).`);
            router.refresh();
          })
        }
      >
        <Send aria-hidden="true" /> Enviar aviso
      </Button>
      <p className="text-xs text-muted">
        {blocked
          ? `Último envío hace ${daysSince} ${daysSince === 1 ? "día" : "días"}: podrás enviar otro dentro de ${7 - daysSince!} días.`
          : "Consejo: uno al mes como mucho. Si molestas, la gente desactiva todos los avisos (también los recordatorios)."}
      </p>
    </div>
  );
}
