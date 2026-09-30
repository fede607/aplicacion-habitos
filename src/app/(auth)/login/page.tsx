import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/validation";
import { enabledOAuthProviders } from "@/lib/auth-providers";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

const OAUTH_ERRORS: Record<string, string> = {
  invite_required:
    "Para crear una cuenta necesitas una invitación: abre el enlace que te ha pasado tu grupo y pulsa ahí «Continuar con Google/Apple». Si ya tenías cuenta con tu correo, entra con él.",
  oauth: "No se ha podido completar el acceso. Inténtalo de nuevo.",
  oauth_disabled: "Ese método de acceso no está activado todavía.",
};

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next =
    typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  const oauthError =
    typeof params.error === "string" ? OAUTH_ERRORS[params.error] : undefined;
  return (
    <div className="grid gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Bienvenido de vuelta
        </h1>
        <p className="mt-1 text-sm text-muted">
          Tu Year Arc te está esperando.
        </p>
      </div>
      {oauthError ? (
        <p
          role="alert"
          className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm"
        >
          {oauthError}
        </p>
      ) : null}
      <div className="grid gap-4 rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <OAuthButtons providers={enabledOAuthProviders()} next={next} />
        <LoginForm next={next} />
      </div>
      <p className="text-center text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <Link
          href={
            next ? `/register?next=${encodeURIComponent(next)}` : "/register"
          }
          className="font-semibold text-primary hover:underline"
        >
          Regístrate
        </Link>
      </p>
    </div>
  );
}
