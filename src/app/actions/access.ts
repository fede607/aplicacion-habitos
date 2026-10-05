"use server";

import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/errors";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

/** Staff: crea una invitación personal de un solo uso (caduca en 14 días). */
export async function staffCreateAccessCode(note: string): Promise<ActionResult<{ code: string }>> {
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { data, error } = await supabase.rpc("staff_create_access_code", { p_note: note.trim().slice(0, 60), p_days: 14 });
  if (error || !data) return fail(error, "staffCreateAccessCode");
  revalidatePath("/pro/pagos");
  return { ok: true, data: { code: data } };
}

/** Staff: anula una invitación que aún no se ha usado. */
export async function staffRevokeAccessCode(code: string): Promise<ActionResult> {
  if (!/^[A-Z2-9]{10}$/.test(code)) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("staff_revoke_access_code", { p_code: code });
  if (error) return fail(error, "staffRevokeAccessCode");
  revalidatePath("/pro/pagos");
  return { ok: true, data: undefined };
}

/** Staff: abre o cierra el registro (cerrado = sólo con invitación). */
export async function staffSetInviteOnly(on: boolean): Promise<ActionResult> {
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("staff_set_invite_only", { p_on: on });
  if (error) return fail(error, "staffSetInviteOnly");
  revalidatePath("/pro/pagos");
  revalidatePath("/register");
  return { ok: true, data: undefined };
}

/** Staff: abre o cierra la venta de Pro (cerrada = Pro gratis para todos). */
export async function staffSetPaymentsOpen(on: boolean): Promise<ActionResult> {
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("staff_set_payments_open", { p_on: on });
  if (error) return fail(error, "staffSetPaymentsOpen");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
