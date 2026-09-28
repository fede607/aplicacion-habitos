"use client";

import { useEffect } from "react";

/** Registra el service worker sólo en producción (en dev interfiere con HMR). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sin SW la app funciona igual (sólo pierde la página offline).
    });
  }, []);
  return null;
}
