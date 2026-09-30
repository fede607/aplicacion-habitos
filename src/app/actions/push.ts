"use server";

import { z } from "zod";
import { fail, logServerError, type ActionResult } from "@/lib/errors";
import { getVapidKeys, sendPushToUser } from "@/lib/push/server";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

export async function getPushPublicKey(): Promise<ActionResult<{ publicKey: string }>> {
  const { userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  try {
    return { ok: true, data: { publicKey: (await getVapidKeys()).publicKey } };
  } catch (e) {
    logServerError("getPushPublicKey", e);
    return { ok: false, error: "Las notificaciones no están disponibles ahora mismo." };
  }
}

export async function savePushSubscription(input: unknown, userAgent: string): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Suscripción no válida." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const s = parsed.data;
  // Si el endpoint ya existía (p. ej. de otra cuenta en este móvil), se reasigna.
  await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: userId,
    endpoint: s.endpoint,
    p256dh: s.keys.p256dh,
    auth: s.keys.auth,
    user_agent: userAgent.slice(0, 300),
  });
  if (error) return fail(error, "savePushSubscription");
  return { ok: true, data: undefined };
}

export async function deletePushSubscription(endpoint: string): Promise<ActionResult> {
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint.slice(0, 1000));
  if (error) return fail(error, "deletePushSubscription");
  return { ok: true, data: undefined };
}

export async function sendTestPush(): Promise<ActionResult<{ delivered: number }>> {
  const { userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  try {
    const delivered = await sendPushToUser(userId, {
      title: "🔥 Winter Arc",
      body: "¡Así te llegarán los recordatorios para no perder tu racha!",
      url: "/today",
      tag: "test",
    });
    return delivered ? { ok: true, data: { delivered } } : { ok: false, error: "No hay ningún dispositivo activado." };
  } catch (e) {
    logServerError("sendTestPush", e);
    return { ok: false, error: "No se ha podido enviar la prueba." };
  }
}
