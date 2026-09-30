import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { enabledOAuthProviders, OAUTH_INVITE_COOKIE, type OAuthProvider } from "@/lib/auth-providers";
import { inviteCodeSchema, safeNextPath } from "@/lib/validation";
import { getSiteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Inicia el login con Google/Apple (PKCE). Si viene de una invitación, el código
 * se guarda en una cookie httpOnly de 15 min para usarlo en /auth/callback.
 */
export async function GET(request: NextRequest) {
  const site = getSiteUrl();
  const provider = request.nextUrl.searchParams.get("provider") as OAuthProvider | null;
  if (!provider || !enabledOAuthProviders().includes(provider)) {
    return NextResponse.redirect(new URL("/login?error=oauth_disabled", site));
  }
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const invite = inviteCodeSchema.safeParse(request.nextUrl.searchParams.get("invite") ?? "");

  const cookieStore = await cookies();
  if (invite.success) {
    cookieStore.set(OAUTH_INVITE_COOKIE, invite.data, { httpOnly: true, secure: true, sameSite: "lax", path: "/auth", maxAge: 15 * 60 });
  } else {
    cookieStore.delete({ name: OAUTH_INVITE_COOKIE, path: "/auth" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
      ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : {}),
    },
  });
  if (error || !data.url) return NextResponse.redirect(new URL("/login?error=oauth", site));
  return NextResponse.redirect(data.url);
}
