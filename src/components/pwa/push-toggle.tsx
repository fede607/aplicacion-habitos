"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { BellOff, BellRing, LoaderCircle, Send } from "lucide-react";
import { deletePushSubscription, getPushPublicKey, savePushSubscription, sendTestPush } from "@/app/actions/push";
import { Button } from "@/components/ui/button";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function base64UrlToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function detect(): Promise<State> {
  if (typeof window === "undefined") return Promise.resolve("loading");
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return Promise.resolve(ios && !standalone ? "ios-install" : "unsupported");
  }
  if (Notification.permission === "denied") return Promise.resolve("denied");
  return navigator.serviceWorker.ready
    .then((reg) => reg.pushManager.getSubscription())
    .then((sub) => (sub ? "on" : "off") as State)
    .catch(() => "unsupported" as State);
}

/** Activa/desactiva los avisos push en ESTE dispositivo. */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    // Sin service worker registrado (desarrollo) no hay push: se detecta con timeout.
    const timeout = new Promise<State>((r) => setTimeout(() => r("unsupported"), 4000));
    void Promise.race([detect(), timeout]).then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  const enable = () =>
    startTransition(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const key = await getPushPublicKey();
      if (!key.ok) {
        toast.error(key.error);
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(key.data.publicKey) });
        const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
        if (!res.ok) {
          await sub.unsubscribe();
          toast.error(res.error);
          return;
        }
        setState("on");
        toast.success("¡Avisos activados en este dispositivo!");
      } catch {
        toast.error("Tu navegador no ha permitido activar los avisos.");
      }
    });

  const disable = () =>
    startTransition(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Avisos desactivados en este dispositivo");
    });

  const test = () =>
    startTransition(async () => {
      const res = await sendTestPush();
      if (res.ok) toast.success("Prueba enviada: te llegará en unos segundos");
      else toast.error(res.error);
    });

  if (state === "loading") return <p className="text-sm text-muted">Comprobando tu dispositivo…</p>;
  if (state === "ios-install")
    return (
      <p className="text-sm text-muted">
        En iPhone los avisos sólo funcionan con la app instalada: instálala (Compartir → «Añadir a pantalla de inicio») y ábrela desde el icono para
        activarlos.
      </p>
    );
  if (state === "unsupported") return <p className="text-sm text-muted">Este navegador no admite avisos. Prueba con Chrome, Edge, Firefox o la app instalada.</p>;
  if (state === "denied")
    return (
      <p className="text-sm text-muted">
        Has bloqueado los avisos para esta web. Actívalos en los ajustes del navegador (icono del candado junto a la dirección → Notificaciones →
        Permitir) y vuelve aquí.
      </p>
    );

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">
        {state === "on"
          ? "Activados en este dispositivo. Te avisaremos a tu hora de recordatorio si te quedan hábitos por marcar."
          : "Recibe un aviso en el móvil a tu hora de recordatorio si te quedan hábitos por marcar, para no perder la racha."}
      </p>
      <div className="flex flex-wrap gap-2">
        {state === "on" ? (
          <>
            <Button variant="outline" disabled={pending} onClick={disable}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <BellOff aria-hidden="true" />} Desactivar
            </Button>
            <Button variant="secondary" disabled={pending} onClick={test}>
              <Send aria-hidden="true" /> Enviar prueba
            </Button>
          </>
        ) : (
          <Button variant="pro" size="lg" disabled={pending} onClick={enable}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <BellRing aria-hidden="true" />} Activar avisos
          </Button>
        )}
      </div>
    </div>
  );
}
