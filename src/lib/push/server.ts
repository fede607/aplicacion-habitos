import "server-only";
import { createECDH } from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import { createAdminClient } from "../supabase/admin";
import { getSiteUrl } from "../env";
import { logServerError } from "../errors";

type Vapid = { publicKey: string; privateKey: string };
let cached: Vapid | null = null;

/** Clave pública VAPID (P-256 sin comprimir, base64url) derivada de la privada. */
function publicFromPrivate(privateKey: string): string {
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(Buffer.from(privateKey, "base64url"));
  return ecdh.getPublicKey().toString("base64url");
}

/**
 * Claves VAPID de la app. La privada se genera una única vez en el servidor y
 * se guarda en la configuración privada de la BD (sólo service_role); la
 * pública se deriva de ella, así que dos peticiones simultáneas nunca acaban
 * con pares distintos.
 */
export async function getVapidKeys(): Promise<Vapid> {
  if (cached) return cached;
  const admin = createAdminClient();
  let { data: privateKey } = await admin.rpc("billing_config_get", {
    p_key: "vapid_private_key",
  });
  if (!privateKey) {
    const { data, error } = await admin.rpc("billing_config_set_if_absent", {
      p_key: "vapid_private_key",
      p_value: webpush.generateVAPIDKeys().privateKey,
    });
    if (error || !data) throw error ?? new Error("vapid");
    privateKey = data;
  }
  return (cached = { publicKey: publicFromPrivate(privateKey), privateKey });
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

/** Envía a todos los dispositivos del usuario. Borra las suscripciones caducadas. Devuelve cuántos recibieron. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs?.length) return 0;
  const vapid = await getVapidKeys();
  const subject = getSiteUrl().startsWith("https://")
    ? getSiteUrl()
    : "mailto:notificaciones@winterarc.app";
  let delivered = 0;
  await Promise.all(
    subs.map(async (s) => {
      const sub: PushSubscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload), {
          vapidDetails: {
            subject,
            publicKey: vapid.publicKey,
            privateKey: vapid.privateKey,
          },
          TTL: 60 * 60 * 6,
          urgency: "normal",
          topic: payload.tag?.slice(0, 32),
        });
        delivered++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          logServerError("push:send", { message: `status ${status ?? "?"}` });
        }
      }
    }),
  );
  return delivered;
}
