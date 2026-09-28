"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Link2, RefreshCw, Share2, Trash2 } from "lucide-react";
import { createInvitation, regenerateInvitation, revokeInvitation } from "@/app/actions/groups";
import type { GroupInvitationRow } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";

function formatCode(code: string) {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

function invitationStatus(inv: GroupInvitationRow, nowIso: string) {
  if (inv.revoked_at) return { label: "Revocada", tone: "neutral" as const, active: false };
  if (inv.expires_at && inv.expires_at <= nowIso) return { label: "Caducada", tone: "neutral" as const, active: false };
  if (inv.max_uses !== null && inv.use_count >= inv.max_uses) return { label: "Agotada", tone: "neutral" as const, active: false };
  return { label: "Activa", tone: "success" as const, active: true };
}

const EXPIRY_OPTIONS = [
  { value: "24", label: "24 horas" },
  { value: "168", label: "7 días" },
  { value: "720", label: "30 días" },
  { value: "2160", label: "90 días" },
  { value: "", label: "Sin caducidad" },
];

export function InvitationsManager({
  groupId,
  invitations,
  siteUrl,
  nowIso,
}: {
  groupId: string;
  invitations: GroupInvitationRow[];
  siteUrl: string;
  nowIso: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expires, setExpires] = useState("168");
  const [maxUses, setMaxUses] = useState("");

  const policy = { groupId, expiresInHours: expires ? Number(expires) : null, maxUses: maxUses ? Number(maxUses) : null };
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else toast.error(res.error);
    });

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copiado`);
    } catch {
      toast.error("No se pudo copiar. Selecciónalo manualmente.");
    }
  };

  const share = async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Únete a mi Winter Arc", text: "Te invito a mi grupo de Winter Arc", url });
        return;
      } catch {
        return;
      }
    }
    await copy(url, "Enlace");
  };

  const visible = invitations.slice(0, 20);

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 rounded-2xl bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Caducidad" htmlFor="inv-exp">
          <Select id="inv-exp" value={expires} onChange={(e) => setExpires(e.target.value)}>
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Usos máximos" htmlFor="inv-uses">
          <Select id="inv-uses" value={maxUses} onChange={(e) => setMaxUses(e.target.value)}>
            <option value="">Ilimitados</option>
            {[1, 5, 10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button disabled={pending} onClick={() => run(() => createInvitation(policy), "Invitación creada")}>
            <Link2 aria-hidden="true" /> Crear
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            title="Revoca todas las invitaciones activas y crea una nueva"
            onClick={() => {
              if (window.confirm("Se revocarán todas las invitaciones activas. ¿Continuar?")) run(() => regenerateInvitation(policy), "Código regenerado");
            }}
          >
            <RefreshCw aria-hidden="true" /> Regenerar
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted">No hay invitaciones. Crea una para invitar a tus amigos.</p>
      ) : (
        <ul className="grid gap-2.5">
          {visible.map((inv) => {
            const status = invitationStatus(inv, nowIso);
            const url = `${siteUrl}/join/${inv.code}`;
            return (
              <li key={inv.id} className="grid gap-3 rounded-2xl border border-border p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="tabular rounded-lg bg-surface-2 px-2 py-1 font-mono text-sm font-semibold tracking-wider">{formatCode(inv.code)}</code>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    {inv.use_count} {inv.use_count === 1 ? "uso" : "usos"}
                    {inv.max_uses ? ` de ${inv.max_uses}` : ""} ·{" "}
                    {inv.expires_at ? `caduca ${new Date(inv.expires_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}` : "sin caducidad"}
                  </p>
                </div>
                {status.active ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => void share(url)}>
                      <Share2 aria-hidden="true" /> Compartir
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void copy(url, "Enlace")} aria-label={`Copiar enlace ${formatCode(inv.code)}`}>
                      <Link2 aria-hidden="true" /> Enlace
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void copy(inv.code, "Código")} aria-label={`Copiar código ${formatCode(inv.code)}`}>
                      <Copy aria-hidden="true" /> Código
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      disabled={pending}
                      aria-label={`Revocar invitación ${formatCode(inv.code)}`}
                      onClick={() => run(() => revokeInvitation(inv.id), "Invitación revocada")}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
