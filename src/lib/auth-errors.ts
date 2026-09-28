/** Traduce errores de Supabase Auth a mensajes claros sin revelar si una cuenta existe. */
export const TOO_MANY = "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";

export function signInErrorMessage(error: { code?: string; status?: number }): string {
  if (error.code === "email_not_confirmed") return "Confirma tu email antes de entrar (revisa tu bandeja de entrada y spam).";
  if (error.status === 429 || error.code === "over_request_rate_limit") return TOO_MANY;
  return "Email o contraseña incorrectos.";
}

export function signUpErrorMessage(error: { code?: string; status?: number }): { form: string; field?: [string, string] } {
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return { form: TOO_MANY };
  }
  if (error.code === "weak_password") return { form: "Contraseña demasiado débil.", field: ["password", "Elige una contraseña más robusta."] };
  if (error.code === "user_already_exists" || error.code === "email_exists") {
    return { form: "No se ha podido crear la cuenta. Si ya tienes una, inicia sesión." };
  }
  if (error.code === "signup_disabled") return { form: "El registro está desactivado temporalmente." };
  return { form: "No se ha podido crear la cuenta. Inténtalo de nuevo." };
}
