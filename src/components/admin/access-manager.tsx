"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Lock, LockOpen, MessageCircle } from "lucide-react";
import { staffCreateAccessCode, staffRevokeAccessCode, staffSetInviteOnly } from "@/app/actions/access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AccessCode = { code: string; note: string; expiresAt: string; usedAt: string | null; usedBy: string | null; revoked: boolean };

const linkFor = (code: string) => `${window.location.origin}/register?acceso=${code}`;
const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

function status(c: AccessCode): { label: string; tone: "success" | "primary" | undefined } {
  if (c.usedAt) return { label: `Usada por @${c.usedBy ?? "?"}`, tone: "success" };
  if (c.revoked) return { label: "Anulada", tone: undefined };
  if (new Date(c.expiresAt) < new Date()) return { label: "Caducada", tone: undefined };
  return { label: `Sin usar · caduca ${fmt(c.expiresAt)}`, tone: "primary" };
}

/** Invitaciones personales de un solo uso: sólo entra quien recibe un enlace del staff. */
export function AccessManager({ inviteOnly, codes }: { inviteOnly: boolean; codes: AccessCode[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = () =>
    start(async () => {
      const res = await staffCreateAccessCode(note);
      if (!res.ok) return void toast.error(res.error);
      setCreated(res.data.code);
      setCopied(false);
      setNote("");
      router.refresh();
    });

  const message = (code: string) => `Te invito a Year Arc, la app para cumplir tus hábitos durante 365 días. Este enlace es solo para ti (sirve una vez): ${linkFor(code)}`;

  return (
    <div className="grid gap-4">
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3 text-sm ${inviteOnly ? "bg-primary-soft" : "bg-warning-soft text-warning"}`}>
        <span className="flex items-center gap-2 font-semibold">
          {inviteOnly ? <Lock className="size-4" aria-hidden="true" /> : <LockOpen className="size-4" aria-hidden="true" />}
          {inviteOnly ? "Registro cerrado: sólo con tus invitaciones" : "Registro abierto: cualquiera puede crear cuenta"}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (inviteOnly && !window.confirm("¿Abrir el registro a cualquiera que tenga el enlace de la web?")) return;
              const res = await staffSetInviteOnly(!inviteOnly);
              if (!res.ok) return void toast.error(res.error);
              toast.success(inviteOnly ? "Registro abierto" : "Registro cerrado");
              router.refresh();
            })
          }
        >
          {inviteOnly ? "Abrir a todos" : "Cerrar registro"}
        </Button>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder="Para quién (p. ej. Ana prima)" aria-label="Para quién es la invitación" />
        <Button type="submit" disabled={pending} className="shrink-0">
          Crear invitación
        </Button>
      </form>

      {created ? (
        <div className="grid gap-2 rounded-2xl border-2 border-dashed border-primary p-3">
          <p className="text-sm font-semibold">Invitación lista. Mándasela sólo a esa persona:</p>
          <p className="font-mono text-xs break-all select-all">{linkFor(created)}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message(created));
                  setCopied(true);
                } catch {}
              }}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? "Copiado" : "Copiar mensaje"}
            </Button>
            <Button type="button" variant="secondary" asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent(message(created))}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" /> WhatsApp
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      {codes.length ? (
        <ul className="grid gap-2">
          {codes.map((c) => {
            const st = status(c);
            const usable = !c.usedAt && !c.revoked && new Date(c.expiresAt) > new Date();
            return (
              <li key={c.code} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border p-3 text-sm">
                <span className="font-mono text-xs">{c.code}</span>
                {c.note ? <span className="font-semibold">{c.note}</span> : null}
                <Badge tone={st.tone}>{st.label}</Badge>
                {usable ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await staffRevokeAccessCode(c.code);
                        if (!res.ok) return void toast.error(res.error);
                        toast.success("Invitación anulada");
                        router.refresh();
                      })
                    }
                  >
                    Anular
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">Aún no has creado invitaciones.</p>
      )}
    </div>
  );
}
