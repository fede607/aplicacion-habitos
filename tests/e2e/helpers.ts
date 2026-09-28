import { expect, type Page } from "@playwright/test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Autoriza un email como "creador" (lo que haría el propietario con SQL). */
export async function allowSignup(email: string) {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY necesaria para los E2E");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_allow_signup`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ p_email: email }),
  });
  if (!res.ok) throw new Error(`admin_allow_signup ${res.status}`);
}
import { randomBytes } from "node:crypto";

export function newUser(prefix: string) {
  const id = randomBytes(4).toString("hex");
  return {
    name: `${prefix[0].toUpperCase()}${prefix.slice(1)} ${id.slice(0, 3)}`,
    username: `${prefix}_${id}`.slice(0, 24),
    email: `${prefix}.${id}@e2e.winterarc.local`,
    password: `Winter-${id}-2026`,
  };
}

export type E2EUser = ReturnType<typeof newUser>;

/** Rellena y envía el formulario de registro de la página actual. */
export async function fillRegisterForm(page: Page, user: E2EUser) {
  await page.getByLabel("Nombre", { exact: true }).fill(user.name);
  await page.getByLabel("Nombre de usuario").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await expect(page.getByTestId("captcha-ok")).toBeVisible();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

/** Registra a un "creador" (organizador autorizado). */
export async function register(page: Page, user: E2EUser, next?: string) {
  await allowSignup(user.email);
  await page.goto(next ? `/register?next=${encodeURIComponent(next)}` : "/register");
  await fillRegisterForm(page, user);
}

/** Registra a un amigo desde el enlace de invitación. */
export async function registerWithInvite(page: Page, user: E2EUser, code: string) {
  await page.goto(`/join/${code}`);
  await page.getByRole("link", { name: "Crear mi cuenta" }).click();
  await expect(page.getByText("Te han invitado a")).toBeVisible();
  await fillRegisterForm(page, user);
}

export async function login(page: Page, user: E2EUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await expect(page.getByTestId("captcha-ok")).toBeVisible();
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/(today|onboarding)/);
}

export async function logout(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Registra errores de consola (incl. hidratación) y de página para fallar el test. */
export function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  // El stack mínimo sin Docker (scripts/local-stack) no incluye el servidor Realtime.
  const ignoreRealtime = process.env.E2E_REALTIME_UNAVAILABLE === "1";
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (ignoreRealtime && msg.text().includes("/realtime/v1/websocket")) return;
    errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

/** Sin scroll horizontal = nada se sale de la pantalla. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "la página no debe tener scroll horizontal").toBeLessThanOrEqual(1);
}
