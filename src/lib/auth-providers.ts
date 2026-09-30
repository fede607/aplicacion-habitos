/** Proveedores de login social activos (variable AUTH_PROVIDERS, p. ej. "google,apple"). */
export type OAuthProvider = "google" | "apple";

export function enabledOAuthProviders(): OAuthProvider[] {
  const raw = (process.env.AUTH_PROVIDERS ?? "").toLowerCase();
  return (["google", "apple"] as const).filter((p) =>
    raw
      .split(",")
      .map((s) => s.trim())
      .includes(p),
  );
}

export const OAUTH_INVITE_COOKIE = "wa_oauth_invite";
