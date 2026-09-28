import { expect, test } from "@playwright/test";
import { newUser, register } from "./helpers";

const PROTECTED = ["/today", "/dashboard", "/calendar", "/workouts", "/progress", "/group", "/group/admin", "/settings", "/onboarding", "/join/ABCDEFGHJKLM"];

test("las rutas protegidas redirigen a login sin sesión", async ({ page }) => {
  for (const path of PROTECTED) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login\?next=/);
  }
});

test("no hay open redirect tras el login", async ({ page }) => {
  const user = newUser("redir");
  await register(page, user);
  await expect(page).toHaveURL(/\/onboarding/);
  await page.context().clearCookies();
  await page.goto("/login?next=https://evil.example.com");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/localhost.*\/(today|onboarding)/);
});

test("cabeceras de seguridad y CSP con nonce", async ({ request }) => {
  const res = await request.get("/login");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("el bundle del cliente no contiene secretos", async ({ page }) => {
  const scripts: string[] = [];
  page.on("response", async (r) => {
    if (r.url().includes("/_next/static/") && r.url().endsWith(".js")) scripts.push(await r.text());
  });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const bundle = scripts.join("\n");
  expect(bundle.length).toBeGreaterThan(1000);
  expect(bundle).not.toMatch(/service_role/);
  expect(bundle).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
});

test("login con credenciales incorrectas muestra un error genérico", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nadie@e2e.winterarc.local");
  await page.getByLabel("Contraseña").fill("incorrecta123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
});

test("una invitación inválida no revela información", async ({ page }) => {
  await register(page, newUser("curious"));
  await expect(page).toHaveURL(/\/onboarding/);
  await page.goto("/join/ZZZZZZZZZZZZ");
  await expect(page.getByRole("heading", { name: "Invitación no disponible" })).toBeVisible();
});
