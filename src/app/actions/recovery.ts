"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { fail, logServerError, type ActionResult } from "@/lib/errors";
import { passwordSchema } from "@/lib/validation";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

/** Genera (o regenera) la clave de recuperación del usuario con sesión. Sólo se muestra esta vez. */
export async function createMyRecoveryCode(): Promise<ActionResult<{ code: string }>> {
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { data, error } = await supabase.rpc("create_recovery_code");
  if (error || !data) return fail(error, "createMyRecoveryCode");
  return { ok: true, data: { code: data } };
}

const resetSchema = z.object({
  login: z.string().trim().min(3, "Escribe tu usuario o email").max(254),
  code: z.string().trim().min(16, "La clave tiene 16 caracteres").max(40),
  password: passwordSchema,
});

const WRONG = "Usuario o clave de recuperación incorrectos.";

/**
 * Cambia la contraseña con la clave de recuperación (sin correos). La clave se
 * comprueba y se invalida en la BD; se devuelve una clave nueva para guardar.
 */
export async function resetPasswordWithCode(input: z.input<typeof resetSchema>): Promise<ActionResult<{ newCode: string }>> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.path[0] === "code" ? WRONG : (issue?.message ?? "Revisa los campos.") };
  }
  if (!isAdminConfigured()) return { ok: false, error: "La recuperación no está disponible ahora mismo." };
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("recovery_redeem", { p_login: parsed.data.login, p_code: parsed.data.code, p_ip: ip });
  if (error) {
    if (/rate limited/.test(error.message)) return { ok: false, error: "Demasiados intentos. Espera una hora e inténtalo de nuevo." };
    logServerError("resetPasswordWithCode:redeem", error);
    return { ok: false, error: "No se ha podido comprobar la clave. Inténtalo de nuevo." };
  }
  const row = data?.[0];
  if (!row) return { ok: false, error: WRONG };
  const { error: updError } = await admin.auth.admin.updateUserById(row.user_id, { password: parsed.data.password });
  if (updError) {
    logServerError("resetPasswordWithCode:update", updError);
    const weak = /password/i.test(updError.message);
    return { ok: false, error: `${weak ? "Esa contraseña no es válida, elige otra." : "No se ha podido cambiar la contraseña."} Tu nueva clave de recuperación es ${row.new_code}: guárdala.` };
  }
  return { ok: true, data: { newCode: row.new_code } };
}
