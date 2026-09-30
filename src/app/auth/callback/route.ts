import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OAUTH_INVITE_COOKIE } from "@/lib/auth-providers";
import { safeNextPath } from "@/lib/validation";
import { getSiteUrl } from "@/lib/env";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Vuelta de Google/Apple. Canjea el código (PKCE), une a la persona al grupo de
 * la invitación si la había y, si es una cuenta NUEVA sin invitación válida, la
 * elimina en el acto: Winter Arc sigue siendo sólo por invitación.
 */
export async function GET(request: NextRequest) {
  const site = getSiteUrl();
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/login?error=oauth", site));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=oauth", site));
  const user = data.user;

  const cookieStore = await cookies();
  const invite = cookieStore.get(OAUTH_INVITE_COOKIE)?.value;
  cookieStore.delete({ name: OAUTH_INVITE_COOKIE, path: "/auth" });

  if (invite) {
    const { error: joinError } = await supabase.rpc("join_group", { p_code: invite });
    if (joinError) logServerError("oauth:join", joinError);
  }

  const { count } = await supabase.from("group_members").select("group_id", { count: "exact", head: true }).eq("user_id", user.id);
  const isNew = Date.now() - new Date(user.created_at).getTime() < 10 * 60 * 1000;
  if ((count ?? 0) === 0 && isNew) {
    const { data: staff } = await supabase.rpc("am_i_staff");
    if (!staff) {
      await supabase.auth.signOut();
      const { error: delError } = await createAdminClient().auth.admin.deleteUser(user.id);
      if (delError) logServerError("oauth:delete-orphan", delError);
      return NextResponse.redirect(new URL("/login?error=invite_required", site));
    }
  }
  return NextResponse.redirect(new URL((count ?? 0) === 0 ? "/onboarding" : next, site));
}
