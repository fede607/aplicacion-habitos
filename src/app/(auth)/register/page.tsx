import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Sparkles, Users } from "lucide-react";
import { SOURCE_COOKIE, cleanSource } from "@/lib/signup-source";
import { RegisterForm } from "@/components/auth/register-form";
import { createClient } from "@/lib/supabase/server";
import { inviteFromParams } from "@/lib/invite";
import { safeNextPath } from "@/lib/validation";
import { enabledOAuthProviders } from "@/lib/auth-providers";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { getPublicProof } from "@/lib/data/public-proof";
import { ReviewCards, StatsStrip } from "@/components/reviews/social-proof";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  const code = inviteFromParams(params);
  const source = cleanSource(typeof params.src === "string" ? params.src : (await cookies()).get(SOURCE_COOKIE)?.value);

  const proof = await getPublicProof();
  let invite: { code: string; groupName: string } | null = null;
  let inviteProblem = false;
  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("invite_signup_preview", {
      p_code: code,
    });
    if (data?.[0]?.status === "valid" && data[0].group_name) invite = { code, groupName: data[0].group_name };
    else inviteProblem = true;
  }

  return (
    <div className="grid gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Empieza tu Year Arc</h1>
        <p className="mt-1 text-sm text-muted">Crea tu cuenta, elige tus hábitos y empieza a pintar tu año.</p>
      </div>

      {invite ? (
        <p role="status" className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm">
          <Users className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Te han invitado a <strong className="break-words">{invite.groupName}</strong>. Al crear la cuenta entrarás directamente.
          </span>
        </p>
      ) : (
        <p role="status" className="flex items-start gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            {inviteProblem ? "Esta invitación no es válida o ha caducado, pero puedes registrarte igual y crear tu grupo. " : ""}
            Gratis y con <b>1 mes de Pro</b> de regalo.
          </span>
        </p>
      )}

      <div className="grid gap-4 rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <OAuthButtons providers={enabledOAuthProviders()} invite={invite?.code} next={next} />
        <RegisterForm next={next} invite={invite?.code} source={source} />
      </div>
      <StatsStrip stats={proof.stats} />
      <ReviewCards reviews={proof.reviews} limit={2} className="sm:grid-cols-1" />
      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-primary hover:underline">
          Entra
        </Link>
      </p>
    </div>
  );
}
