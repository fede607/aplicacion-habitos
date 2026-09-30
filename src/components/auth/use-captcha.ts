"use client";

import { useCallback, useState } from "react";
import { captchaEnabled } from "./turnstile";

/** Estado del CAPTCHA de un formulario: token actual y reinicio tras cada intento. */
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const reset = useCallback(() => {
    setToken(null);
    setResetSignal((n) => n + 1);
  }, []);
  const onLoadError = useCallback(() => setLoadError(true), []);
  return {
    token,
    setToken,
    resetSignal,
    reset,
    onLoadError,
    loadError,
    ready: !captchaEnabled || token !== null,
    options: captchaEnabled && token ? { captchaToken: token } : {},
  };
}

export const CAPTCHA_PENDING =
  "Completa la verificación anti-bots para continuar.";
export const CAPTCHA_LOAD_ERROR =
  "No se ha podido cargar la verificación anti-bots. Desactiva bloqueadores y recarga la página.";
