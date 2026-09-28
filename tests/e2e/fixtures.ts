import { test as base, expect, type BrowserContext } from "@playwright/test";

/**
 * Turnstile simulado: Cloudflare no es accesible desde el entorno de tests. Emite
 * un token fijo tras "resolver" el reto, igual que el widget real. En producción
 * Supabase Auth valida el token real contra Cloudflare.
 */
export const E2E_CAPTCHA_TOKEN = "e2e-captcha-token";

const FAKE_TURNSTILE = `
(() => {
  const widgets = {};
  let n = 0;
  window.turnstile = {
    render(el, opts) {
      const id = "w" + (++n);
      widgets[id] = opts;
      const box = document.createElement("div");
      box.textContent = "Verificación completada (simulada)";
      box.setAttribute("data-testid", "captcha-ok");
      el.appendChild(box);
      setTimeout(() => opts.callback(${JSON.stringify(E2E_CAPTCHA_TOKEN)}), 50);
      return id;
    },
    reset(id) { const o = widgets[id]; if (o) setTimeout(() => o.callback(${JSON.stringify(E2E_CAPTCHA_TOKEN)}), 50); },
    remove(id) { delete widgets[id]; },
  };
})();`;

export async function mockTurnstile(context: BrowserContext) {
  await context.route("https://challenges.cloudflare.com/turnstile/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: FAKE_TURNSTILE }),
  );
}

export const test = base.extend({
  context: async ({ context }, provide) => {
    await mockTurnstile(context);
    await provide(context);
  },
});

export { expect };
