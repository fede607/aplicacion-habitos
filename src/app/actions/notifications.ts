"use server";

import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, logServerError, type ActionResult } from "@/lib/errors";
import { emailSchema, uuidSchema } from "@/lib/validation";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isEmailConfigured, sendEmail } from "@/lib/email/mailer";
import { verificationEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

const prefsSchema = z.object({ daily: z.boolean(), weekly: z.boolean() });

export async function updateEmailPreferences(input: { daily: boolean; weekly: boolean }): Promise<ActionResult> {
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase
    .from("user_settings")
    .update({ email_daily_reminder: parsed.data.daily, email_weekly_summary: parsed.data.weekly })
    .eq("user_id", userId);
  if (error) return fail(error, "updateEmailPreferences");
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

/**
 * Pide usar otro email para notificaciones. Se envía un enlace de verificación;
 * hasta confirmarlo no se usa. El token se genera aquí y sólo viaja por email.
 */
export async function requestNotificationEmail(email: string): Promise<ActionResult<"verified" | "sent">> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: "Email no válido.", fieldErrors: { email: "Email no válido." } };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;

  const { data: current } = await supabase.rpc("my_notification_email");
  const me = current?.[0];
  if (me && me.account_confirmed && me.account_email.toLowerCase() === parsed.data) {
    const { error } = await supabase.rpc("use_account_email_for_notifications");
    if (error) return fail(error, "switchToAccountEmail");
    revalidatePath("/settings");
    return { ok: true, data: "verified" };
  }

  if (!isEmailConfigured() || !isAdminConfigured()) {
    return { ok: false, error: "El envío de emails aún no está configurado en el servidor." };
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_create_email_verification", {
    p_user_id: userId,
    p_email: parsed.data,
    p_token_hash: tokenHash,
  });
  if (error) return fail(error, "createEmailVerification");

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).single();
  try {
    await sendEmail({
      to: parsed.data,
      ...verificationEmail({ name: profile?.display_name ?? "", url: `${getSiteUrl()}/notifications/verify?token=${token}` }),
    });
  } catch (e) {
    logServerError("sendVerificationEmail", e);
    return { ok: false, error: "No se ha podido enviar el email. Inténtalo más tarde." };
  }
  revalidatePath("/settings");
  return { ok: true, data: "sent" };
}

export async function switchToAccountEmail(): Promise<ActionResult> {
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("use_account_email_for_notifications");
  if (error) return fail(error, "switchToAccountEmail");
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

export async function unsubscribeFromEmails(token: string): Promise<boolean> {
  const parsed = uuidSchema.safeParse(token);
  if (!parsed.success) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("unsubscribe_emails", { p_token: parsed.data });
  return Boolean(data);
}
