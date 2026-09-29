import "server-only";
import Stripe from "stripe";
import { createAdminClient } from "../supabase/admin";
import { getSiteUrl } from "../env";
import { logServerError } from "../errors";

/**
 * Stripe sólo en servidor. La tarjeta se introduce en Stripe Checkout (página
 * alojada por Stripe, PCI DSS nivel 1): la app nunca ve ni guarda datos de pago.
 */
export const PRO_PRICE_CENTS = 200;
export const PRO_CURRENCY = "eur";
export const WEBHOOK_PATH = "/api/stripe/webhook";
const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];

let client: Stripe | null = null;

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY");
  if (!client) client = new Stripe(key, { appInfo: { name: "Winter Arc" } });
  return client;
}

/** Secreto del webhook: variable de entorno o el que la app creó automáticamente. */
export async function getWebhookSecret(): Promise<string | null> {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET;
  const { data, error } = await createAdminClient().rpc("billing_config_get", { p_key: "stripe_webhook_secret" });
  if (error) logServerError("billing:getWebhookSecret", error);
  return data ?? null;
}

/**
 * Registra el webhook en Stripe la primera vez (idempotente). Así basta con
 * configurar STRIPE_SECRET_KEY: renovaciones y cancelaciones llegan solas.
 */
export async function ensureWebhook(): Promise<void> {
  if (await getWebhookSecret()) return;
  const stripe = getStripe();
  const url = `${getSiteUrl()}${WEBHOOK_PATH}`;
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  // Un endpoint previo sin secreto guardado no sirve (Stripe sólo lo muestra al crearlo).
  for (const ep of existing.data) if (ep.url === url) await stripe.webhookEndpoints.del(ep.id);
  const created = await stripe.webhookEndpoints.create({ url, enabled_events: WEBHOOK_EVENTS, description: "Winter Arc Pro" });
  if (!created.secret) throw new Error("Stripe no devolvió el secreto del webhook");
  const { error } = await createAdminClient().rpc("billing_config_set", { p_key: "stripe_webhook_secret", p_value: created.secret });
  if (error) throw error;
}

function periodEnd(sub: Stripe.Subscription): string | null {
  const ends = sub.items.data.map((i) => i.current_period_end).filter((n): n is number => typeof n === "number");
  return ends.length ? new Date(Math.max(...ends) * 1000).toISOString() : null;
}

/** Copia el estado de una suscripción de Stripe a la BD (única vía de escritura). */
export async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const userId = sub.metadata?.user_id;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const admin = createAdminClient();
  const row = {
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    current_period_end: periodEnd(sub),
    cancel_at_period_end: sub.cancel_at_period_end || sub.cancel_at !== null,
    updated_at: new Date().toISOString(),
  };
  const { error } = userId
    ? await admin.from("subscriptions").upsert({ user_id: userId, ...row }, { onConflict: "user_id" })
    : await admin.from("subscriptions").update(row).eq("stripe_customer_id", customerId);
  if (error) throw error;
}
