import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Alta de cuentas (registro abierto). Protecciones:
 * - Validación de campos en el servidor.
 * - Límite de 5 altas por IP y hora y 300 en total por hora (signup_rate_check).
 * - Cloudflare Turnstile si TURNSTILE_SECRET_KEY está configurado.
 * - Acceso privado: si está activado, exige una invitación personal de un solo uso.
 * Crea la cuenta con el email confirmado y devuelve la sesión.
 */

// CORS abierto: no es una barrera de seguridad (se protege con límites y CAPTCHA).
function cors(_req: Request) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const USERNAME = /^[a-z0-9_]{3,24}$/;
const SOURCE = /^[a-z0-9_-]{1,32}$/;
const PRIVATE_MSG = "Year Arc está en acceso privado: necesitas una invitación personal. Pídesela a quien te habló de la app.";

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const username = String(body.username ?? "").trim().toLowerCase();
    const displayName = String(body.displayName ?? "").trim().slice(0, 40);
    const timezone = String(body.timezone ?? "Europe/Madrid").slice(0, 64);
    const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.slice(0, 64) : undefined;
    const source = typeof body.source === "string" && SOURCE.test(body.source.toLowerCase()) ? body.source.toLowerCase() : undefined;
    const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : "";
    const accessCode = typeof body.accessCode === "string" ? body.accessCode.slice(0, 32) : "";

    if (!EMAIL.test(email) || email.length > 254) return json({ error: "Email no válido.", field: "email" }, 400);
    if (password.length < 8 || password.length > 72 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return json({ error: "La contraseña necesita 8 caracteres con letras y números.", field: "password" }, 400);
    }
    if (!USERNAME.test(username)) return json({ error: "Nombre de usuario no válido.", field: "username" }, 400);
    if (!displayName) return json({ error: "Escribe tu nombre.", field: "displayName" }, 400);
    if (body.acceptTerms !== true) return json({ error: "Debes tener 14 años o más y aceptar los términos y la política de privacidad." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Anti-bots: CAPTCHA (si está configurado) y límite de altas.
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
    if (turnstileSecret) {
      const form = new FormData();
      form.append("secret", turnstileSecret);
      form.append("response", captchaToken);
      form.append("remoteip", ip);
      const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
      const result = (await verify.json()) as { success?: boolean };
      if (!result.success) return json({ error: "Completa la verificación anti-bots e inténtalo de nuevo." }, 400);
    }
    const { error: rateErr } = await admin.rpc("signup_rate_check", { p_ip: ip });
    if (rateErr) return json({ error: "Demasiados registros seguidos. Espera un rato e inténtalo de nuevo." }, 429);

    const { data: inviteOnly } = await admin.rpc("signup_is_invite_only");
    if (inviteOnly) {
      const { data: ok } = await admin.rpc("access_code_check", { p_code: accessCode });
      if (!ok) return json({ error: accessCode ? "Esta invitación no es válida, ya se ha usado o ha caducado. Pide una nueva." : PRIVATE_MSG, field: "access" }, 403);
    }

    const { data: available } = await admin.rpc("username_available", { p_username: username });
    if (available === false) return json({ error: "username_taken", field: "username" }, 400);

    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: displayName,
        timezone,
        terms_accepted_at: new Date().toISOString(),
        ...(inviteCode ? { invite_code: inviteCode } : {}),
        ...(source ? { signup_source: source } : {}),
        ...(accessCode ? { access_code: accessCode } : {}),
      },
    });

    if (createErr) {
      const raw = createErr.message ?? "";
      let msg = "No se ha podido crear la cuenta. Inténtalo de nuevo.";
      if (/already registered|already been registered|email.*(taken|exists)|ya existe/i.test(raw)) {
        msg = "Ya existe una cuenta con ese email. Prueba a iniciar sesión.";
      } else if (/access code/i.test(raw) || (inviteOnly && createErr.status === 500)) {
        msg = "Esta invitación no es válida, ya se ha usado o ha caducado. Pide una nueva.";
      } else if (inviteCode && (/invit|invite/i.test(raw) || createErr.status === 500)) {
        msg = "El enlace de invitación no es válido o ya ha caducado.";
      } else if (/password/i.test(raw)) {
        msg = "La contraseña no cumple los requisitos mínimos.";
      }
      return json({ error: msg }, 400);
    }

    const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: sess, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
    if (signInErr || !sess?.session) return json({ created: true, fallback: true });

    return json({ created: true, access_token: sess.session.access_token, refresh_token: sess.session.refresh_token });
  } catch (err) {
    console.error("register-user error:", err);
    return json({ error: "Error interno. Inténtalo de nuevo." }, 500);
  }
});
