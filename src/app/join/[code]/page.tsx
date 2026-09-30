import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
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
  rate_limited: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.",
};

/**
 * Puerta de entrada al grupo. Sin sesión: muestra el grupo y lleva a crear cuenta
 * (con el código) o a entrar. Con sesión: botón para unirse.
 */
export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code: raw } = await params;
  const parsed = inviteCodeSchema.safeParse(decodeURIComponent(raw));
  const code = parsed.success ? parsed.data : null;
  const session = await getSession();

  let status = "invalid";
  let groupName: string | null = null;
  let memberCount: number | null = null;
  let description: string | null = null;

  if (code && session) {
    const { data, error } = await session.supabase.rpc("get_invitation_preview", { p_code: code });
    if (error?.code === "WA429") status = "rate_limited";
    else if (data?.[0]) {
      if (data[0].already_member) redirect("/today");
      status = data[0].status;
      groupName = data[0].group_name;
      memberCount = data[0].member_count;
      description = data[0].group_description;
    }
  } else if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("invite_signup_preview", { p_code: code });
    if (error?.code === "WA429") status = "rate_limited";
    else if (data?.[0]) {
      status = data[0].status;
      groupName = data[0].group_name;
    }
  }

  const valid = status === "valid" && code && groupName;
  return (
    <AuthShell>
      <div className="grid gap-5 rounded-3xl border border-border bg-surface p-6 text-center shadow-card">
        {valid ? (
          <>
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Users className="size-7" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted">Te han invitado a</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight break-words">{groupName}</h1>
              {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
              {memberCount !== null ? (
                <p className="mt-2 text-sm text-muted">
                  {memberCount} {memberCount === 1 ? "miembro" : "miembros"}
                </p>
              ) : null}
            </div>
            {session ? (
              <JoinButton code={code} />
            ) : (
              <div className="grid gap-2">
                <Button asChild size="lg">
                  <Link href={`/register?invite=${code}`}>Crear mi cuenta</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/login?next=${encodeURIComponent(`/join/${code}`)}`}>Ya tengo cuenta</Link>
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Invitación no disponible</h1>
            <p className="text-sm text-muted">{STATUS_TEXT[status] ?? STATUS_TEXT.invalid}</p>
            <Button asChild variant="secondary">
              <Link href={session ? "/onboarding" : "/login"}>{session ? "Introducir un código" : "Entrar"}</Link>
            </Button>
          </>
        )}
      </div>
    </AuthShell>
  );
}
