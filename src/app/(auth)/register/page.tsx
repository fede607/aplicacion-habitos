import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Lock, Sparkles, Users } from "lucide-react";
import { SOURCE_COOKIE, cleanSource } from "@/lib/signup-source";
import { RegisterForm } from "@/components/auth/register-form";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { ContactLine } from "@/components/legal/legal-page";
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

  const access = typeof params.acceso === "string" ? params.acceso.slice(0, 32) : undefined;
  const supabaseAnon = await createClient();
  const { data: inviteOnly } = await supabaseAnon.rpc("signup_is_invite_only");
  let accessOk = false;
  if (inviteOnly && access && isAdminConfigured()) {
    const { data } = await createAdminClient().rpc("access_code_check", { p_code: access });
    accessOk = data === true;
  }
  if (inviteOnly && !accessOk) {
    return (
      <div className="grid gap-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
          <Lock className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Year Arc está en acceso privado</h1>
          <p className="mt-2 text-sm text-muted">
            {access
              ? "Esta invitación no es válida, ya se ha usado o ha caducado. Cada invitación sirve para una sola persona: pide una nueva a quien te la mandó."
              : "Por ahora sólo se puede entrar con una invitación personal. Pídesela a quien te habló de la app."}
          </p>
        </div>
        <p className="text-sm text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Entra
          </Link>
        </p>
        <ContactLine />
      </div>
    );
  }

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
            {accessOk ? <b>Tienes una invitación personal. </b> : null}Gratis y con <b>1 mes de Pro</b> de regalo.
          </span>
        </p>
      )}

      <div className="grid gap-4 rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <OAuthButtons providers={enabledOAuthProviders()} invite={invite?.code} next={next} />
        {enabledOAuthProviders().length ? (
          <p className="text-center text-xs text-muted">
            Al continuar con Google o Apple confirmas que tienes 14 años o más y aceptas los{" "}
            <Link href="/terminos" className="underline">
              términos
            </Link>{" "}
            y la{" "}
            <Link href="/privacidad" className="underline">
              privacidad
            </Link>
            .
          </p>
        ) : null}
        <RegisterForm next={next} invite={invite?.code} source={source} access={accessOk ? access : undefined} />
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
