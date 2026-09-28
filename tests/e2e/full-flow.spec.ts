/**
 * Flujo completo pedido:
 * Usuario A: registro → crear grupo → crear hábito → registrar hábitos → notas → entrenamiento → cerrar sesión
 * Usuario B: registro → unirse por enlace → ver dashboard → registrar hábitos
 * Verificación: los datos persisten tras cerrar sesión/volver a entrar y el grupo ve el progreso de ambos.
 */
import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow, login, logout, newUser, register, trackConsoleErrors } from "./helpers";

test.describe.configure({ mode: "serial" });

async function markHabit(page: Page, name: string) {
  const button = page.getByRole("button", { name: `Marcar ${name} como completado` });
  await button.click();
  await expect(page.getByRole("button", { name: `Desmarcar ${name}` })).toHaveAttribute("aria-pressed", "true");
}

async function waitAllSaved(page: Page) {
  await expect(page.getByText("Todo guardado")).toBeVisible();
}

test("flujo completo de dos usuarios en un grupo", async ({ page, browser }, testInfo) => {
  const errors = trackConsoleErrors(page);
  const alice = newUser("alice");
  const bob = newUser("bob");
  const groupName = `WINTER ARC E2E ${testInfo.project.name}`;

  // ---------- Usuario A ----------
  await register(page, alice);
  await expect(page).toHaveURL(/\/onboarding/);
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("Nombre del Winter Arc").fill(groupName);
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await expect(page).toHaveURL(/\/group\/admin\?created=1/);
  await expect(page.getByText("¡Grupo creado! Comparte el enlace")).toBeVisible();

  // Los 9 hábitos iniciales existen y se puede crear uno nuevo desde la app.
  await expect(page.getByText("Proyecto Google AdSense")).toBeVisible();
  await page.getByRole("button", { name: "Añadir hábito" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo hábito" });
  await dialog.getByLabel("Nombre", { exact: true }).fill("Beber 2L de agua");
  await dialog.getByLabel("Objetivo", { exact: true }).fill("2 litros");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Beber 2L de agua")).toBeVisible();

  // Invitación: se toma el código de la primera invitación activa.
  const code = (await page.locator("code").first().innerText()).replace(/-/g, "");
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
  await expectNoHorizontalOverflow(page);

  // Registrar hábitos de hoy.
  await page.goto("/today");
  await markHabit(page, "Beber 2L de agua");
  await markHabit(page, "Lectura");
  await markHabit(page, "Movilidad / estiramientos");
  await page.getByRole("button", { name: "No aplica" }).first().click();
  await waitAllSaved(page);
  await expectNoHorizontalOverflow(page);

  // Notas del día (autoguardado).
  await page.getByLabel("¿Qué hice hoy?").fill("Entrené boxeo durante 1 hora y estudié 2 horas.");
  await page.getByLabel("¿Qué puedo mejorar mañana?").fill("Dejar el móvil fuera de la habitación mientras estudio.");
  await page.getByLabel("¿Qué hice hoy?").click();
  await expect(page.getByText("Guardado", { exact: true })).toBeVisible();

  // Entrenamiento.
  await page.getByRole("link", { name: "Registrar entrenamiento" }).click();
  await expect(page).toHaveURL(/\/workouts\/new/);
  await page.locator("label").filter({ hasText: "Boxeo" }).click();
  await expect(page.getByRole("radio", { name: /Boxeo/ })).toBeChecked();
  await page.getByLabel("Duración (min)").fill("60");
  await page.getByRole("radio", { name: "8 de 10" }).first().click();
  await page.getByLabel("Observaciones").fill("Trabajé desplazamientos y combinaciones.");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/workouts$/);
  await expect(page.getByText("Trabajé desplazamientos y combinaciones.")).toBeVisible();

  // Persistencia: recargar y cerrar sesión / volver a entrar.
  await logout(page);
  await login(page, alice);
  await page.goto("/today");
  await expect(page.getByRole("button", { name: "Desmarcar Lectura" })).toBeVisible();
  await expect(page.getByLabel("¿Qué hice hoy?")).toHaveValue("Entrené boxeo durante 1 hora y estudié 2 horas.");
  await logout(page);

  // ---------- Usuario B (otro "dispositivo": contexto nuevo) ----------
  const bobContext = await browser.newContext({ ...testInfo.project.use, locale: "es-ES", timezoneId: "Europe/Madrid" });
  const bobPage = await bobContext.newPage();
  const bobErrors = trackConsoleErrors(bobPage);

  // Enlace de invitación sin sesión → login/registro → vuelve a la invitación.
  await bobPage.goto(`/join/${code}`);
  await expect(bobPage).toHaveURL(/\/login\?next=%2Fjoin%2F/);
  await bobPage.getByRole("link", { name: "Regístrate" }).click();
  await expect(bobPage).toHaveURL(/\/register\?next=/);
  await bobPage.getByLabel("Nombre", { exact: true }).fill(bob.name);
  await bobPage.getByLabel("Nombre de usuario").fill(bob.username);
  await bobPage.getByLabel("Email").fill(bob.email);
  await bobPage.getByLabel("Contraseña").fill(bob.password);
  await bobPage.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(bobPage).toHaveURL(new RegExp(`/join/${code}`));
  await expect(bobPage.getByRole("heading", { name: groupName })).toBeVisible();
  await bobPage.getByRole("button", { name: "Unirme al grupo" }).click();
  await expect(bobPage).toHaveURL(/\/today/);

  // Dashboard.
  await bobPage.goto("/dashboard");
  await expect(bobPage.getByRole("heading", { name: "Tu panel" })).toBeVisible();
  await expectNoHorizontalOverflow(bobPage);

  // Registrar sus hábitos.
  await bobPage.goto("/today");
  await markHabit(bobPage, "Lectura");
  await markHabit(bobPage, "Actitud positiva");
  await waitAllSaved(bobPage);

  // Bob ve el grupo con ambos miembros, pero NO las notas de Alice.
  await bobPage.goto("/group");
  await expect(bobPage.locator("main").getByText(alice.name)).toBeVisible();
  await expect(bobPage.locator("main").getByText(bob.name)).toBeVisible();
  await expect(bobPage.getByText("Entrené boxeo durante 1 hora")).toHaveCount(0);
  await expect(bobPage.getByText("💪 1 entrenos")).toBeVisible(); // resumen compartido de Alice
  await expectNoHorizontalOverflow(bobPage);

  // Bob no es admin: la administración no está disponible.
  await bobPage.goto("/group/admin");
  await expect(bobPage).toHaveURL(/\/group$/);

  // Persistencia tras recargar.
  await bobPage.goto("/today");
  await expect(bobPage.getByRole("button", { name: "Desmarcar Lectura" })).toBeVisible();

  // ---------- Alice ve el progreso de Bob ----------
  await login(page, alice);
  await page.goto("/group");
  await expect(page.locator("main").getByText(bob.name)).toBeVisible();
  await page.goto("/calendar");
  await expect(page.getByRole("grid")).toBeVisible();
  await page.goto("/progress");
  await expect(page.locator("main li").filter({ hasText: "Primer paso" })).toContainText("Desbloqueado");

  expect(errors, "sin errores de consola/hidratación (A)").toEqual([]);
  expect(bobErrors, "sin errores de consola/hidratación (B)").toEqual([]);
  await bobContext.close();
});
