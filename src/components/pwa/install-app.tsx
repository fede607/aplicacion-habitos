"use client";

import { useSyncExternalStore } from "react";
import {
  Download,
  Share,
  SquarePlus,
  X,
  ExternalLink,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  canPrompt,
  canPromptServer,
  getPlatform,
  getServerPlatform,
  promptInstall,
  subscribe,
} from "./install-state";

const DISMISS_KEY = "wa-install-dismissed";
const dismissListeners = new Set<() => void>();

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Sin almacenamiento el aviso volverá a salir; no pasa nada.
  }
  dismissListeners.forEach((l) => l());
}

function useInstall() {
  const platform = useSyncExternalStore(
    subscribe,
    getPlatform,
    getServerPlatform,
  );
  const promptable = useSyncExternalStore(
    subscribe,
    canPrompt,
    canPromptServer,
  );
  return { platform, promptable };
}

function Steps({
  platform,
  promptable,
}: {
  platform: ReturnType<typeof getPlatform>;
  promptable: boolean;
}) {
  if (platform === "inapp") {
    return (
      <p className="text-sm">
        Estás dentro de Instagram (u otra app) y desde aquí no se puede
        instalar. Pulsa{" "}
        <MoreVertical className="inline size-4" aria-label="menú" /> o{" "}
        <b>···</b> arriba y elige <b>«Abrir en el navegador»</b>{" "}
        <ExternalLink className="inline size-3.5" aria-hidden="true" />. Luego
        vuelve a esta pantalla.
      </p>
    );
  }
  if (platform === "ios") {
    return (
      <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
        <li>
          Abre la web en <b>Safari</b>.
        </li>
        <li>
          Pulsa <b>Compartir</b>{" "}
          <Share className="inline size-4" aria-hidden="true" /> (abajo en el
          centro).
        </li>
        <li>
          Elige <b>«Añadir a pantalla de inicio»</b>{" "}
          <SquarePlus className="inline size-4" aria-hidden="true" /> y pulsa{" "}
          <b>Añadir</b>.
        </li>
      </ol>
    );
  }
  if (promptable)
    return (
      <p className="text-sm">
        Se instala en un segundo y se abre a pantalla completa, como cualquier
        app.
      </p>
    );
  return (
    <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
      <li>
        Abre la web en <b>Chrome</b>.
      </li>
      <li>
        Pulsa <MoreVertical className="inline size-4" aria-label="menú" />{" "}
        arriba a la derecha.
      </li>
      <li>
        Elige <b>«Instalar aplicación»</b> o{" "}
        <b>«Añadir a pantalla de inicio»</b>.
      </li>
    </ol>
  );
}

/** Tarjeta completa (Ajustes y página /instalar). */
export function InstallAppCard() {
  const { platform, promptable } = useInstall();
  if (platform === "unknown") return null;
  if (platform === "installed") {
    return (
      <p className="rounded-2xl bg-success-soft p-4 text-sm font-medium text-success">
        ✅ Ya tienes Year Arc instalada en este dispositivo.
      </p>
    );
  }
  return (
    <div className="grid gap-4">
      <Steps platform={platform} promptable={promptable} />
      {promptable ? (
        <Button
          variant="pro"
          size="xl"
          className="w-full"
          onClick={() => void promptInstall()}
        >
          <Download aria-hidden="true" /> Instalar Year Arc
        </Button>
      ) : null}
    </div>
  );
}

/** Aviso en la app para móviles, descartable. */
export function InstallAppBanner() {
  const { platform, promptable } = useInstall();
  const dismissed = useSyncExternalStore(
    (l) => {
      dismissListeners.add(l);
      return () => dismissListeners.delete(l);
    },
    readDismissed,
    () => true,
  );
  if (
    dismissed ||
    platform === "unknown" ||
    platform === "installed" ||
    platform === "desktop"
  )
    return null;
  return (
    <div className="relative mb-5 grid gap-3 rounded-2xl border border-border bg-surface p-4 pr-12 lg:hidden">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        className="absolute top-2 right-2 inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
      <p className="flex items-center gap-2 font-semibold">
        <Download className="size-5 text-primary" aria-hidden="true" /> Instala
        Year Arc en tu móvil
      </p>
      <Steps platform={platform} promptable={promptable} />
      {promptable ? (
        <Button
          variant="pro"
          size="lg"
          className="w-full"
          onClick={() => void promptInstall()}
        >
          <Download aria-hidden="true" /> Instalar app
        </Button>
      ) : null}
    </div>
  );
}
