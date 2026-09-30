"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, type ActionResult } from "@/lib/errors";
import type { GroupInvitationRow, GroupRole } from "@/lib/database.types";
import { createGroupSchema, createInvitationSchema, fieldErrors, groupSettingsSchema, habitSchema, inviteCodeSchema, uuidSchema } from "@/lib/validation";
import { z } from "zod";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

function refreshApp() {
  revalidatePath("/", "layout");
}

// -----------------------------------------------------------------------------
// Crear / unirse / cambiar de grupo
// -----------------------------------------------------------------------------
export async function createGroup(input: z.input<typeof createGroupSchema>): Promise<ActionResult<{ groupId: string }>> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Revisa los campos.",
      fieldErrors: fieldErrors(parsed.error),
    };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;

  const { data, error } = await supabase.rpc("create_group", {
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_start_date: parsed.data.startDate,
    p_end_date: parsed.data.endDate,
    p_seed_defaults: parsed.data.seedDefaults,
  });
  if (error || !data) return fail(error, "createGroup");
  refreshApp();
  return { ok: true, data: { groupId: data } };
}

/**
 * «Crear grupo» en un toque: grupo nuevo con los hábitos por defecto (365 días)
 * y su código de invitación, listo para copiar y compartir.
 */
export async function quickCreateGroup(): Promise<ActionResult<{ groupId: string; code: string | null }>> {
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  const firstName = (profile?.display_name ?? "").trim().split(/\s+/)[0]?.slice(0, 40);
  const { data: groupId, error } = await supabase.rpc("create_group", {
    p_name: firstName ? `Grupo de ${firstName}` : "Mi grupo",
    p_description: "",
    p_seed_defaults: true,
  });
  if (error || !groupId) return fail(error, "quickCreateGroup");
  const { data: inv } = await supabase
    .from("group_invitations")
    .select("code")
    .eq("group_id", groupId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  refreshApp();
  return { ok: true, data: { groupId, code: inv?.code ?? null } };
}

const JOIN_ERRORS: Record<string, string> = {
  invalid: "Ese código no es válido. Revisa que esté bien escrito.",
  revoked: "Esta invitación ha sido revocada. Pide un enlace nuevo.",
  expired: "Esta invitación ha caducado. Pide un enlace nuevo.",
  exhausted: "Esta invitación ya se ha usado el máximo de veces.",
  full: "El grupo está completo.",
};

export async function joinGroup(code: string): Promise<ActionResult<{ groupId: string }>> {
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Código no válido.",
    };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;

  const { data, error } = await supabase.rpc("join_group", {
    p_code: parsed.data,
  });
  if (error) return fail(error, "joinGroup");
  const result = data?.[0];
  if (!result?.group_id)
    return {
      ok: false,
      error: JOIN_ERRORS[result?.status ?? "invalid"] ?? JOIN_ERRORS.invalid,
    };
  refreshApp();
  return { ok: true, data: { groupId: result.group_id } };
}

export async function setActiveGroup(groupId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(groupId);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.from("user_settings").update({ active_group_id: parsed.data }).eq("user_id", userId);
  if (error) return fail(error, "setActiveGroup");
  refreshApp();
  return { ok: true, data: undefined };
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(groupId);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("leave_group", {
    p_group_id: parsed.data,
  });
  if (error) return fail(error, "leaveGroup");
  refreshApp();
  redirect("/today");
}

// -----------------------------------------------------------------------------
// Administración (los permisos se verifican en BD; aquí sólo se valida la forma)
// -----------------------------------------------------------------------------
export async function updateGroupSettings(input: z.input<typeof groupSettingsSchema>): Promise<ActionResult> {
  const parsed = groupSettingsSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Revisa los campos.",
      fieldErrors: fieldErrors(parsed.error),
    };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const g = parsed.data;
  const { data, error } = await supabase
    .from("groups")
    .update({
      name: g.name,
      description: g.description,
      rules: g.rules,
      start_date: g.startDate,
      end_date: g.endDate,
      streak_threshold: g.streakThreshold,
      comparison_enabled: g.comparisonEnabled,
      max_members: g.maxMembers,
    })
    .eq("id", g.groupId)
    .select("id");
  if (error) return fail(error, "updateGroupSettings");
  if (!data?.length) return { ok: false, error: "No tienes permiso para hacer esto." };
  refreshApp();
  return { ok: true, data: undefined };
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(groupId);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("delete_group", {
    p_group_id: parsed.data,
  });
  if (error) return fail(error, "deleteGroup");
  refreshApp();
  redirect("/today");
}

const memberActionSchema = z.object({
  groupId: uuidSchema,
  userId: uuidSchema,
});

export async function removeMember(input: { groupId: string; userId: string }): Promise<ActionResult> {
  const parsed = memberActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("remove_member", {
    p_group_id: parsed.data.groupId,
    p_user_id: parsed.data.userId,
  });
  if (error) return fail(error, "removeMember");
  refreshApp();
  return { ok: true, data: undefined };
}

export async function setMemberRole(input: { groupId: string; userId: string; role: GroupRole }): Promise<ActionResult> {
  const parsed = memberActionSchema.extend({ role: z.enum(["admin", "member"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("set_member_role", {
    p_group_id: parsed.data.groupId,
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) return fail(error, "setMemberRole");
  refreshApp();
  return { ok: true, data: undefined };
}

export async function transferAdmin(input: { groupId: string; userId: string }): Promise<ActionResult> {
  const parsed = memberActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("transfer_admin", {
    p_group_id: parsed.data.groupId,
    p_user_id: parsed.data.userId,
  });
  if (error) return fail(error, "transferAdmin");
  refreshApp();
  return { ok: true, data: undefined };
}

export async function createInvitation(input: z.input<typeof createInvitationSchema>): Promise<ActionResult<GroupInvitationRow>> {
  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Revisa los campos.",
      fieldErrors: fieldErrors(parsed.error),
    };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { data, error } = await supabase.rpc("create_invitation", {
    p_group_id: parsed.data.groupId,
    p_expires_in_hours: parsed.data.expiresInHours,
    p_max_uses: parsed.data.maxUses,
  });
  if (error || !data) return fail(error, "createInvitation");
  revalidatePath("/group/admin");
  return { ok: true, data };
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(invitationId);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("revoke_invitation", {
    p_invitation_id: parsed.data,
  });
  if (error) return fail(error, "revokeInvitation");
  revalidatePath("/group/admin");
  return { ok: true, data: undefined };
}

/** Regenerar = revocar todas las activas y crear una nueva con la misma política. */
export async function regenerateInvitation(input: z.input<typeof createInvitationSchema>): Promise<ActionResult<GroupInvitationRow>> {
  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { data: active, error: listError } = await supabase.from("group_invitations").select("id").eq("group_id", parsed.data.groupId).is("revoked_at", null);
  if (listError) return fail(listError, "regenerateInvitation:list");
  for (const inv of active ?? []) {
    const { error } = await supabase.rpc("revoke_invitation", {
      p_invitation_id: inv.id,
    });
    if (error) return fail(error, "regenerateInvitation:revoke");
  }
  return createInvitation(parsed.data);
}

// -----------------------------------------------------------------------------
// Hábitos del grupo
// -----------------------------------------------------------------------------
export async function saveHabit(input: z.input<typeof habitSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = habitSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Revisa los campos.",
      fieldErrors: fieldErrors(parsed.error),
    };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const h = parsed.data;
  const row = {
    name: h.name,
    description: h.description,
    icon: h.icon,
    category: h.category,
    color: h.color,
    frequency: h.frequency,
    weekdays: h.frequency === "weekdays" ? h.weekdays : [],
    weekly_target: h.frequency === "weekly_target" ? h.weeklyTarget : null,
    is_optional: h.isOptional,
    weight: h.weight,
    goal: h.goal,
    starts_on: h.startsOn,
  };

  if (h.id) {
    const { data, error } = await supabase.from("habits").update(row).eq("id", h.id).eq("group_id", h.groupId).select("id");
    if (error) return fail(error, "saveHabit:update");
    if (!data?.length) return { ok: false, error: "No tienes permiso para hacer esto." };
    refreshApp();
    return { ok: true, data: { id: data[0].id } };
  }

  const { data: last } = await supabase.from("habits").select("sort_order").eq("group_id", h.groupId).order("sort_order", { ascending: false }).limit(1);
  const { data, error } = await supabase
    .from("habits")
    .insert({
      ...row,
      group_id: h.groupId,
      sort_order: Math.min((last?.[0]?.sort_order ?? 0) + 10, 10000),
    })
    .select("id")
    .single();
  if (error || !data) return fail(error, "saveHabit:insert");
  refreshApp();
  return { ok: true, data: { id: data.id } };
}

const habitFlagSchema = z.object({ habitId: uuidSchema, value: z.boolean() });

export async function setHabitActive(input: { habitId: string; value: boolean }): Promise<ActionResult> {
  const parsed = habitFlagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { data, error } = await supabase.from("habits").update({ is_active: parsed.data.value }).eq("id", parsed.data.habitId).select("id");
  if (error) return fail(error, "setHabitActive");
  if (!data?.length) return { ok: false, error: "No tienes permiso para hacer esto." };
  refreshApp();
  return { ok: true, data: undefined };
}

export async function archiveHabit(habitId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(habitId);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { data, error } = await supabase.from("habits").update({ archived_at: new Date().toISOString(), is_active: false }).eq("id", parsed.data).select("id");
  if (error) return fail(error, "archiveHabit");
  if (!data?.length) return { ok: false, error: "No tienes permiso para hacer esto." };
  refreshApp();
  return { ok: true, data: undefined };
}

/** Reordena intercambiando sort_order con el vecino. */
export async function moveHabit(input: { groupId: string; habitId: string; direction: "up" | "down" }): Promise<ActionResult> {
  const parsed = z
    .object({
      groupId: uuidSchema,
      habitId: uuidSchema,
      direction: z.enum(["up", "down"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;

  const { data: habits, error } = await supabase
    .from("habits")
    .select("id, sort_order")
    .eq("group_id", parsed.data.groupId)
    .is("archived_at", null)
    .order("sort_order")
    .order("created_at");
  if (error || !habits) return fail(error, "moveHabit:list");

  const index = habits.findIndex((h) => h.id === parsed.data.habitId);
  const swapWith = parsed.data.direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= habits.length) return { ok: true, data: undefined };

  // Normaliza el orden (10, 20, 30…) y aplica el intercambio.
  const ordered = [...habits];
  [ordered[index], ordered[swapWith]] = [ordered[swapWith], ordered[index]];
  for (let i = 0; i < ordered.length; i++) {
    const target = (i + 1) * 10;
    if (ordered[i].sort_order === target) continue;
    const { data, error: updError } = await supabase.from("habits").update({ sort_order: target }).eq("id", ordered[i].id).select("id");
    if (updError) return fail(updError, "moveHabit:update");
    if (!data?.length) return { ok: false, error: "No tienes permiso para hacer esto." };
  }
  refreshApp();
  return { ok: true, data: undefined };
}
