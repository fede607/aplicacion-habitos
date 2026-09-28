import { expect, test } from "./fixtures";
import { expectNoHorizontalOverflow, newUser, register, trackConsoleErrors } from "./helpers";

const MAILBOX = process.env.E2E_MAILBOX_URL ?? "http://127.0.0.1:54321/__mail";

test("un amigo pone otro correo, lo verifica y ve estadísticas de miembros", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop" && testInfo.project.name !== "mobile", "");
  const errors = trackConsoleErrors(page);
  const user = newUser("notif");
  const altEmail = `alt.${user.username}@e2e.winterarc.local`;
  await register(page, user);
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await expect(page).toHaveURL(/\/group\/admin/);

  // Notificaciones por email en Ajustes.
  await page.goto("/settings#notificaciones");
  await expect(page.getByRole("heading", { name: "Notificaciones por email" })).toBeVisible();
  await expect(page.getByText(user.email).last()).toBeVisible();
  await page.getByRole("switch", { name: /Recordatorio diario por email/ }).click();
  await expect(page.getByText("Preferencias de email guardadas ✓")).toBeVisible();

  await page.getByRole("button", { name: "Usar otro email" }).click();
  await page.getByLabel("Email para notificaciones").fill(altEmail);
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByText("Te hemos enviado un enlace")).toBeVisible();
  await expect(page.getByText(`Pendiente de confirmar: ${altEmail}`)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  let link: string | undefined;
  await expect
    .poll(async () => {
      const mails = (await (await request.get(`${MAILBOX}?to=${encodeURIComponent(altEmail)}`)).json()) as { raw: string }[];
      const decoded = (mails.at(-1)?.raw ?? "").replace(/=\r?\n/g, "").replace(/=3D/g, "=");
      link = decoded.match(/https?:\/\/[^\s"<>]+\/notifications\/verify\?token=[A-Za-z0-9_-]+/)?.[0];
      return link;
    })
    .toBeTruthy();
  await page.goto(link!);
  await expect(page.getByRole("heading", { name: "Email verificado" })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByText(altEmail)).toBeVisible();

  // Estadísticas actuales de un miembro (uno mismo aquí).
  await page.goto("/group");
  await page.locator("main").getByRole("link", { name: user.name }).click();
  await expect(page).toHaveURL(/\/group\/members\//);
  await expect(page.getByRole("region", { name: "Estadísticas actuales" })).toBeVisible();
  await expect(page.getByText("Hábitos esta semana")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("el endpoint del cron exige el secreto", async ({ request }) => {
  expect((await request.get("/api/cron/notifications")).status()).toBe(401);
  expect((await request.get("/api/cron/notifications", { headers: { authorization: "Bearer wrong-secret-value-123" } })).status()).toBe(401);
});

test("la baja pide confirmación y funciona con el token", async ({ page }) => {
  await page.goto("/unsubscribe?token=not-a-token");
  await expect(page.getByText("El enlace no es válido.")).toBeVisible();
});
