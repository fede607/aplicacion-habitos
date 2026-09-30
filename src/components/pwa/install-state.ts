"use client";

/**
 * Estado de instalación de la PWA. `beforeinstallprompt` puede dispararse antes
 * de que se monte cualquier botón, así que se captura al cargar la app y se
 * guarda aquí; los componentes se suscriben con useSyncExternalStore.
 */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export type InstallPlatform = "unknown" | "installed" | "android" | "ios" | "inapp" | "desktop";

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function initInstallCapture() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPlatform(): InstallPlatform {
  if (installed) return "installed";
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  if (/Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Snapchat|Line\//i.test(ua)) return "inapp";
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export const getServerPlatform = (): InstallPlatform => "unknown";

export const canPrompt = () => deferred !== null;
export const canPromptServer = () => false;

/** Abre el diálogo nativo de instalación (Chrome/Edge/Samsung Internet). */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  emit();
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === "accepted";
}
