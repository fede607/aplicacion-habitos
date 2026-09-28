import { expect, type Page } from "@playwright/test";
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

/** Registra al usuario y espera la redirección post-registro. */
export async function register(page: Page, user: E2EUser, next?: string) {
  await page.goto(next ? `/register?next=${encodeURIComponent(next)}` : "/register");
  await page.getByLabel("Nombre", { exact: true }).fill(user.name);
  await page.getByLabel("Nombre de usuario").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

export async function login(page: Page, user: E2EUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
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
