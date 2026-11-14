"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import { fieldErrors, registerSchema, safeNextPath } from "@/lib/validation";
import { Field, Input } from "@/components/ui/input";
import { FormError, SubmitButton } from "./form-bits";
import { Turnstile } from "./turnstile";
import { CAPTCHA_LOAD_ERROR, CAPTCHA_PENDING, useCaptcha } from "./use-captcha";

const noop = () => () => {};

/** «José Pérez» → «jose_perez»: minúsculas, sin tildes ni espacios (3-24 caracteres). */
function toUsername(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s.-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24)
    .replace(/_+$/, "");
}

/** Variante libre de un nombre de usuario: añade cifras al final (y garantiza 3+ caracteres). */
function withDigits(base: string): string {
  const digits = String(Math.floor(100 + Math.random() * 900));
  return `${(base || "user").slice(0, 24 - digits.length)}${digits}`;
}

/** Nombre de usuario sugerido a partir del nombre: siempre válido (3-24, a-z0-9_). */
function suggestUsername(name: string): string {
  const base = toUsername(name);
  return base.length >= 3 ? base : base ? withDigits(base) : "";
}

/**
 * Registro abierto (con invitación opcional). Usa la Edge Function `register-user`
 * para crear la cuenta con email ya confirmado y devolver la sesión.
 */
export function RegisterForm({ next, invite, source, access }: { next?: string; invite?: string; source?: string; access?: string }) {
  const router = useRouter();
  const timezone = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "Europe/Madrid",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const captcha = useCaptcha();
  const [accepted, setAccepted] = useState(false);
  // Opcional y desmarcada por defecto: el consentimiento tiene que ser una acción de la persona.
  const [marketing, setMarketing] = useState(false);
  // Con invitación personal (de un solo uso) no hace falta el anti-bots: un bot no puede tener una.
  // Los enlaces de grupo se pueden reenviar, así que con ellos sí se pide.
  const needCaptcha = !access;
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const parsed = registerSchema.safeParse({
          email: form.get("email"),
          password: form.get("password"),
          displayName: form.get("displayName"),
          username: form.get("username"),
          timezone,
        });
        if (!parsed.success) {
          setErrors(fieldErrors(parsed.error));
          setError("Revisa los campos.");
          return;
        }
        // Los campos ya están bien: quitamos los avisos de un intento anterior.
        setErrors({});
        if (!accepted) {
          setError("Para continuar, confirma que tienes 14 años o más y aceptas los términos.");
          return;
        }
        if (needCaptcha && !captcha.ready) {
          setError(CAPTCHA_PENDING);
          return;
        }
        setPending(true);
        setErrors({});
        setError(null);

        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const anonKey =
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

          const resp = await fetch(`${supabaseUrl}/functions/v1/register-user`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
            },
            body: JSON.stringify({
              email: parsed.data.email,
              password: parsed.data.password,
              username: parsed.data.username,
              displayName: parsed.data.displayName,
              timezone: parsed.data.timezone,
              inviteCode: invite,
              accessCode: access,
              source,
              acceptTerms: true,
              marketingOptIn: marketing,
              captchaToken: captcha.token ?? undefined,
            }),
          });

          // Un 502/504 del proveedor puede no traer JSON: no es "sin conexión".
          const result = (await resp.json().catch(() => ({ error: "El servidor no responde. Inténtalo de nuevo en un minuto." }))) as {
            created?: boolean;
            fallback?: boolean;
            access_token?: string;
            refresh_token?: string;
            error?: string;
            field?: string;
          };

          if (!resp.ok || result.error) {
            if (result.field === "username") {
              if (!usernameTouched) {
                // Lo generamos nosotros: proponemos uno libre en vez de dejar a la persona atascada.
                const alt = withDigits(parsed.data.username);
                setUsername(alt);
                setErrors({ username: `Ese ya estaba cogido. Te proponemos «${alt}»: pulsa otra vez Crear cuenta.` });
              } else {
                setErrors({ username: "Ese nombre de usuario ya está cogido." });
              }
            }
            setError(result.error ?? "No se ha podido crear la cuenta. Inténtalo de nuevo.");
            setPending(false);
            captcha.reset();
            return;
          }

          if (result.fallback) {
            // Cuenta creada pero no se pudo obtener sesión automáticamente
            router.replace(
              `/login?created=1&email=${encodeURIComponent(parsed.data.email)}`,
            );
            return;
          }

          if (result.access_token && result.refresh_token) {
            const supabase = getBrowserClient();
            await supabase.auth.setSession({
              access_token: result.access_token,
              refresh_token: result.refresh_token,
            });
            const target = invite ? "/today" : safeNextPath(next, "/onboarding");
            router.replace(target);
            router.refresh();
            return;
          }
          // Respuesta inesperada: nunca dejar el botón girando para siempre.
          setError("No se ha podido completar el registro. Si ya se creó la cuenta, entra con tu email.");
          setPending(false);
          captcha.reset();
        } catch {
          setError("Sin conexión. Inténtalo de nuevo.");
          setPending(false);
          captcha.reset();
        }
      }}
    >
      <FormError message={error} />
      <Field label="Nombre" htmlFor="displayName" error={errors.displayName}>
        <Input
          id="displayName"
          name="displayName"
          autoComplete="name"
          maxLength={40}
          required
          aria-invalid={!!errors.displayName}
          onChange={(e) => {
            if (!usernameTouched) setUsername(suggestUsername(e.target.value));
          }}
        />
      </Field>
      <Field label="Nombre de usuario" htmlFor="username" error={errors.username} hint="Se rellena solo; puedes cambiarlo (minúsculas, números o _)">
        <Input
          id="username"
          name="username"
          value={username}
          onChange={(e) => {
            setUsernameTouched(true);
            setUsername(toUsername(e.target.value));
          }}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={24}
          required
          aria-invalid={!!errors.username}
        />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={!!errors.email} />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={errors.password} hint="Mínimo 8 caracteres, con letras y números">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required aria-invalid={!!errors.password} />
      </Field>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
        <span>
          Tengo 14 años o más y acepto los{" "}
          <a href="/terminos" target="_blank" className="font-medium text-primary underline">
            términos
          </a>{" "}
          y la{" "}
          <a href="/privacidad" target="_blank" className="font-medium text-primary underline">
            política de privacidad
          </a>
          .
        </span>
      </label>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
        <span>
          Quiero recibir novedades y ofertas de Year Arc <span className="text-muted">(opcional; como mucho un aviso a la semana y puedes quitarlo cuando quieras en tu perfil)</span>.
        </span>
      </label>
      {needCaptcha ? (
        <>
          <Turnstile onToken={captcha.setToken} resetSignal={captcha.resetSignal} onLoadError={captcha.onLoadError} />
          {captcha.loadError ? <FormError message={CAPTCHA_LOAD_ERROR} /> : null}
        </>
      ) : null}
      <SubmitButton pending={pending} pendingText="Creando cuenta…">
        Crear cuenta
      </SubmitButton>
    </form>
  );
}
