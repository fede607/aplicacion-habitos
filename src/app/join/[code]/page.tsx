import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { requireSession } from "@/lib/data/session";
import { inviteCodeSchema } from "@/lib/validation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { JoinButton } from "./join-button";

export const metadata: Metadata = { title: "Invitación" };

const STATUS_TEXT: Record<string, string> = {
  invalid: "Este enlace de invitación no es válido.",
  revoked: "Esta invitación ha sido revocada. Pide un enlace nuevo.",
  expired: "Esta invitación ha caducado. Pide un enlace nuevo.",
  exhausted: "Esta invitación ya se ha usado el máximo de veces.",
  full: "El grupo está completo.",
};

export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code: raw } = await params;
  const parsed = inviteCodeSchema.safeParse(decodeURIComponent(raw));
  const { supabase } = await requireSession();

  let status = "invalid";
  let preview: { group_name: string | null; group_description: string | null; member_count: number | null; already_member: boolean } | null = null;
  if (parsed.success) {
    const { data, error } = await supabase.rpc("get_invitation_preview", { p_code: parsed.data });
    if (error?.code === "WA429") status = "rate_limited";
    else if (data?.[0]) {
      status = data[0].status;
      preview = data[0];
    }
  }

  if (preview?.already_member) redirect("/today");

  return (
    <AuthShell>
      <div className="grid gap-5 rounded-3xl border border-border bg-surface p-6 text-center shadow-card">
        {status === "valid" && preview ? (
          <>
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Users className="size-7" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted">Te han invitado a</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight break-words">{preview.group_name}</h1>
              {preview.group_description ? <p className="mt-2 text-sm text-muted">{preview.group_description}</p> : null}
              <p className="mt-2 text-sm text-muted">
                {preview.member_count} {preview.member_count === 1 ? "miembro" : "miembros"}
              </p>
            </div>
            <JoinButton code={parsed.success ? parsed.data : ""} />
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Invitación no disponible</h1>
            <p className="text-sm text-muted">
              {status === "rate_limited"
                ? "Demasiados intentos. Espera unos minutos y vuelve a intentarlo."
                : (STATUS_TEXT[status] ?? STATUS_TEXT.invalid)}
            </p>
            <Button asChild variant="secondary">
              <Link href="/onboarding">Introducir un código</Link>
            </Button>
          </>
        )}
      </div>
    </AuthShell>
  );
}
