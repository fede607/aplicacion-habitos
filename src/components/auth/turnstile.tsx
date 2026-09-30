"use client";

import { useEffect, useRef } from "react";

/**
 * CAPTCHA de Cloudflare Turnstile. Se activa definiendo NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * (y la clave secreta en Supabase → Auth → Attack Protection). El token se envía a
 * Supabase Auth, que es quien lo valida: un bot no puede saltárselo llamando a la API.
 *
 * CSP: el script lo inserta código ya confiable, así que 'strict-dynamic' lo permite
 * sin nonce; el iframe está autorizado en frame-src.
 */
type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const captchaEnabled = TURNSTILE_SITE_KEY !== "";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("turnstile"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function Turnstile({
  onToken,
  resetSignal,
  onLoadError,
}: {
  onToken: (token: string | null) => void;
  /** Cambia este valor para pedir un token nuevo (los tokens son de un solo uso). */
  resetSignal: number;
  onLoadError?: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const tokenCb = useRef(onToken);
  const errorCb = useRef(onLoadError);

  useEffect(() => {
    tokenCb.current = onToken;
    errorCb.current = onLoadError;
  }, [onToken, onLoadError]);

  useEffect(() => {
    if (!captchaEnabled || !container.current) return;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !container.current) return;
        widgetId.current = api.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: "es",
          theme: "auto",
          callback: (token: string) => tokenCb.current(token),
          "expired-callback": () => tokenCb.current(null),
          "error-callback": () => tokenCb.current(null),
        });
      })
      .catch(() => errorCb.current?.());
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetSignal > 0 && widgetId.current && window.turnstile) {
      tokenCb.current(null);
      window.turnstile.reset(widgetId.current);
    }
  }, [resetSignal]);

  if (!captchaEnabled) return null;
  return <div ref={container} className="min-h-[65px]" aria-label="Verificación anti-bots" />;
}

/** Estado del captcha para un formulario. */
export function captchaOptions(token: string | null): { captchaToken?: string } {
  return captchaEnabled && token ? { captchaToken: token } : {};
}
