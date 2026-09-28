/**
 * Recorre todas las pantallas en varios tamaños (móvil pequeño → monitor grande) y
 * en ambos temas: sin scroll horizontal, sin errores de consola, con captura para revisión.
 */
import { expect, test } from "./fixtures";
import { expectNoHorizontalOverflow, newUser, register, trackConsoleErrors } from "./helpers";

const VIEWPORTS = [
  { name: "movil-pequeno", width: 320, height: 640 },
  { name: "movil-grande", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "portatil", width: 1280, height: 800 },
  { name: "monitor", width: 1920, height: 1080 },
];

const PAGES = ["/today", "/dashboard", "/calendar", "/workouts", "/workouts/new", "/progress", "/group", "/group/admin", "/settings", "/onboarding"];

test("todas las páginas se ven bien en cualquier tamaño", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Los viewports se fijan manualmente");
  test.setTimeout(240_000);
  const errors = trackConsoleErrors(page);
  const user = newUser("resp");
  await register(page, user);
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await expect(page).toHaveURL(/\/group\/admin/);
  await page.goto("/today");
  await page.getByRole("button", { name: "Marcar Lectura como completado" }).click();
  await expect(page.getByText("Todo guardado")).toBeVisible();

  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expectNoHorizontalOverflow(page);
        if (theme === "light" || vp.name === "movil-grande") {
          await page.screenshot({
            path: testInfo.outputPath(`${theme}-${vp.name}${path.replace(/\//g, "_")}.png`),
            fullPage: true,
          });
        }
      }
    }
  }
  expect(errors, `errores de consola:\n${[...new Set(errors)].join("\n")}`).toEqual([]);
});
