"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, LoaderCircle, Plus, Share2, UserPlus } from "lucide-react";
import { quickCreateGroup } from "@/app/actions/groups";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { JoinByCodeForm } from "./join-by-code-form";

export function formatInviteCode(code: string) {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

/** Código grande con botones de copiar y compartir. */
export function InviteCodeBox({ code, siteUrl }: { code: string; siteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const pretty = formatInviteCode(code);
  const link = `${siteUrl}/join/${code}`;
  const message = `Únete a mi grupo de Year Arc 💪\nCódigo: ${pretty}\n${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pretty);
      setCopied(true);
      toast.success("Código copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Selecciónalo y cópialo a mano.");
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Year Arc", text: message });
      } catch {
        // Cancelado por el usuario.
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={copy}
        className="rounded-2xl border-2 border-dashed border-primary/50 bg-primary-soft px-4 py-5 text-center"
        aria-label={`Copiar código ${pretty}`}
      >
        <span className="block text-xs font-semibold tracking-widest text-muted uppercase">Código del grupo</span>
        <span className="tabular mt-1 block font-mono text-2xl font-black tracking-[0.2em] text-foreground select-all sm:text-3xl">{pretty}</span>
      </button>
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" variant="outline" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? "Copiado" : "Copiar"}
        </Button>
        <Button size="lg" variant="pro" onClick={share}>
          <Share2 aria-hidden="true" /> Compartir
        </Button>
      </div>
      <p className="text-xs text-muted">
        🎁 Por cada amigo nuevo que se cree la cuenta con tu enlace, <b className="text-foreground">+7 días de Pro para los dos</b> (hasta 10 amigos).
      </p>
    </div>
  );
}

/** Los dos botones del apartado Grupo: crear (instantáneo) y unirse con código. */
export function GroupActions({ siteUrl }: { siteUrl: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<{ code: string | null } | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);

  const create = () =>
    startTransition(async () => {
      const res = await quickCreateGroup();
      if (res.ok) {
        setCreated({ code: res.data.code });
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Button size="xl" variant="pro" disabled={pending} onClick={create}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
          Crear grupo
        </Button>
        <Button size="xl" variant="outline" onClick={() => setJoinOpen(true)}>
          <UserPlus aria-hidden="true" /> Unirse a grupo
        </Button>
      </div>

      <Dialog open={created !== null} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent title="¡Grupo creado! 🎉" description="Pasa este código a tus amigos. Con él entran sólo ellos en tu grupo.">
          {created?.code ? (
            <InviteCodeBox code={created.code} siteUrl={siteUrl} />
          ) : (
            <p className="text-sm text-muted">Tu grupo está listo. Encontrarás el código en Grupo → Administrar.</p>
          )}
          <p className="mt-4 text-xs text-muted">
            Tus amigos entran en <b>Grupo → Unirse a grupo</b> y pegan el código. Puedes cambiar el nombre y los hábitos en Administrar.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent title="Unirse a un grupo" description="Pega el código que te ha pasado tu amigo.">
          <JoinByCodeForm redirectTo="/group" onJoined={() => setJoinOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
