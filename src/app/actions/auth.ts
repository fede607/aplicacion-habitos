"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logServerError, type ActionResult } from "@/lib/errors";
import { fieldErrors, resetPasswordSchema } from "@/lib/validation";

export type AuthFormState = ActionResult<"check-email" | "sent"> | null;

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: "Revisa los campos.",
      fieldErrors: fieldErrors(parsed.error),
    };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims)
    return { ok: false, error: "El enlace ha caducado. Solicita uno nuevo." };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    if (error.code === "same_password") {
      return {
        ok: false,
        error: "Revisa los campos.",
        fieldErrors: { password: "Debe ser distinta de la anterior." },
      };
    }
    logServerError("updatePassword", error);
    return { ok: false, error: "No se ha podido actualizar la contraseña." };
  }
  redirect("/today?password=updated");
}
