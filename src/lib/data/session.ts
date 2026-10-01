import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, type ServerSupabase } from "../supabase/server";
import { todayInTimeZone, type IsoDate } from "../dates";
import type { GroupRole, GroupRow, ProfileRow, UserSettingsRow } from "../database.types";
import { logServerError } from "../errors";

export type Membership = GroupRow & { role: GroupRole; joined_at: string };

export type Session = {
  supabase: ServerSupabase;
  userId: string;
  email: string;
  profile: ProfileRow;
  settings: UserSettingsRow;
  groups: Membership[];
  activeGroup: Membership | null;
  today: IsoDate;
};

export type GroupSession = Session & { activeGroup: Membership };

/**
 * Contexto de la petición: usuario verificado (getClaims valida el JWT contra
 * Supabase), perfil, preferencias y grupos. Memoizado por petición con React cache.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const [profileRes, settingsRes, membersRes, groupsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("user_settings").select("*").eq("user_id", userId).single(),
    supabase.from("group_members").select("group_id, role, joined_at").eq("user_id", userId),
    supabase.from("groups").select("*").is("deleted_at", null).order("created_at"),
  ]);

  if (profileRes.error || settingsRes.error || !profileRes.data || !settingsRes.data) {
    logServerError("session: profile/settings", profileRes.error ?? settingsRes.error);
    return null;
  }

  const roles = new Map((membersRes.data ?? []).map((m) => [m.group_id, m]));
  const groups: Membership[] = (groupsRes.data ?? [])
    .filter((g) => roles.has(g.id))
    .map((g) => ({ ...g, role: roles.get(g.id)!.role, joined_at: roles.get(g.id)!.joined_at }));

  const activeGroup =
    groups.find((g) => g.id === settingsRes.data.active_group_id) ?? groups[0] ?? null;

  return {
    supabase,
    userId,
    email: String(claimsData.claims.email ?? ""),
    profile: profileRes.data,
    settings: settingsRes.data,
    groups,
    activeGroup,
    today: todayInTimeZone(profileRes.data.timezone),
  };
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireGroup(): Promise<GroupSession> {
  const session = await requireSession();
  if (!session.activeGroup) redirect("/onboarding");
  return session as GroupSession;
}

export async function requireGroupAdmin(): Promise<GroupSession> {
  const session = await requireGroup();
  if (session.activeGroup.role !== "admin") redirect("/group");
  return session;
}

/** ¿Acceso completo al grupo activo? (sala gratis, creador o Pro). Lo decide la BD. */
export const hasFullAccess = cache(async (session: GroupSession): Promise<boolean> => {
  if (!session.activeGroup.requires_pro) return true;
  const { data, error } = await session.supabase.rpc("has_full_access", { p_group_id: session.activeGroup.id });
  if (error) logServerError("hasFullAccess", error);
  return data === true;
});

/** Páginas Pro: devuelve la sesión, o null si no tiene Pro (la página muestra la vista bloqueada). */
export async function requireProPage(): Promise<GroupSession | null> {
  const session = await requireGroup();
  return (await hasFullAccess(session)) ? session : null;
}

/** Páginas Pro (redirige a /pro si no tiene acceso). */
export async function requireFullAccess(): Promise<GroupSession> {
  const session = await requireGroup();
  if (!(await hasFullAccess(session))) redirect("/pro?locked=1");
  return session;
}
