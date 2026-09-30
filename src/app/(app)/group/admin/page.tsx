import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireGroupAdmin } from "@/lib/data/session";
import { getAllHabits } from "@/lib/data/queries";
import { getSiteUrl } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupSettingsForm } from "@/components/admin/group-settings-form";
import { HabitsManager } from "@/components/admin/habits-manager";
import { InvitationsManager } from "@/components/admin/invitations-manager";
import { MembersManager, type AdminMember } from "@/components/admin/members-manager";
import { DeleteGroupButton, LeaveGroupButton } from "@/components/admin/danger-zone";

export const metadata: Metadata = { title: "Administrar grupo" };

export default async function GroupAdminPage({ searchParams }: PageProps<"/group/admin">) {
  // requireGroupAdmin es sólo UX: cada acción vuelve a comprobarse en BD (RLS/RPC).
  const { supabase, userId, activeGroup, today, profile } = await requireGroupAdmin();
  const params = await searchParams;

  const [habits, invitationsRes, membersRes] = await Promise.all([
    getAllHabits(supabase, activeGroup.id),
    supabase.from("group_invitations").select("*").eq("group_id", activeGroup.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("group_members").select("user_id, role, joined_at").eq("group_id", activeGroup.id).order("joined_at").limit(1000),
  ]);
  const memberRows = membersRes.data ?? [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_emoji, avatar_color")
    .in("id", memberRows.map((m) => m.user_id));
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const members: AdminMember[] = memberRows.map((m) => {
    const p = byId.get(m.user_id);
    return {
      userId: m.user_id,
      role: m.role,
      joinedAt: m.joined_at,
      name: p?.display_name ?? "Miembro",
      username: p?.username ?? "",
      emoji: p?.avatar_emoji ?? null,
      color: p?.avatar_color ?? "#64748b",
    };
  });

  return (
    <div className="grid gap-6">
      <header>
        <Link href="/group" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden="true" /> Grupo
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Administración</h1>
        <p className="text-sm text-muted break-words">{activeGroup.name}</p>
      </header>

      {params.created ? (
        <p role="status" className="rounded-2xl border border-success/40 bg-success-soft px-4 py-3 text-sm font-medium text-success">
          ¡Grupo creado! Comparte el enlace de invitación con tus amigos para empezar juntos.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base">Invitaciones</CardTitle>
            <CardDescription>Comparte el enlace o el código. Puedes hacer que caduquen, limitar usos o revocarlas.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <InvitationsManager groupId={activeGroup.id} invitations={invitationsRes.data ?? []} siteUrl={getSiteUrl()} nowIso={new Date().toISOString()} timeZone={profile.timezone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base">Hábitos del Year Arc</CardTitle>
            <CardDescription>Se aplican a todos los miembros del grupo.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <HabitsManager groupId={activeGroup.id} habits={habits} today={today} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuración</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupSettingsForm group={activeGroup} />
          </CardContent>
        </Card>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Miembros ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <MembersManager groupId={activeGroup.id} members={members} meId={userId} timeZone={profile.timezone} />
          </CardContent>
        </Card>
      </div>


      <Card className="border-danger/40">
        <CardHeader>
          <div>
            <CardTitle className="text-base text-danger">Zona peligrosa</CardTitle>
            <CardDescription>Para salir siendo el único admin, transfiere antes la administración.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <LeaveGroupButton groupId={activeGroup.id} groupName={activeGroup.name} />
          <DeleteGroupButton groupId={activeGroup.id} groupName={activeGroup.name} />
        </CardContent>
      </Card>
    </div>
  );
}
