/**
 * Recuperación de contraseña de extremo a extremo. Requiere el buzón SMTP del
 * stack local (scripts/local-stack/gateway.mjs expone GET /__mail).
 */
import { expect, test } from "@playwright/test";
import { login, newUser, register } from "./helpers";

const MAILBOX = process.env.E2E_MAILBOX_URL ?? "http://127.0.0.1:54321/__mail";

test("recuperar contraseña por email", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Una vez basta");
  const user = newUser("reset");
  await register(page, user);
  await expect(page).toHaveURL(/\/onboarding/);
  await page.context().clearCookies();

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByText("Si existe una cuenta con ese email")).toBeVisible();

  let link: string | undefined;
  await expect
    .poll(async () => {
      const mails = (await (await request.get(`${MAILBOX}?to=${encodeURIComponent(user.email)}`)).json()) as { raw: string }[];
      const raw = mails.at(-1)?.raw ?? "";
      const decoded = raw.replace(/=\r?\n/g, "").replace(/=3D/g, "=");
      link = decoded.match(/https?:\/\/[^\s"<>]+\/verify\?[^\s"<>]+/)?.[0]?.replace(/&amp;/g, "&");
      return link;
    })
    .toBeTruthy();

  await page.goto(link!);
  await expect(page).toHaveURL(/\/reset-password/);
  const newPassword = "Nueva-clave-2026";
  await page.getByLabel("Nueva contraseña").fill(newPassword);
  await page.getByLabel("Repite la contraseña").fill(newPassword);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page).toHaveURL(/\/(today|onboarding)/);

  await page.context().clearCookies();
  await login(page, { ...user, password: newPassword });
});
