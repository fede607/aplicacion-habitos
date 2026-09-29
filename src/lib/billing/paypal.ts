import "server-only";
import { createAdminClient } from "../supabase/admin";
import { getSiteUrl } from "../env";
import { logServerError } from "../errors";

/**
 * PayPal Subscriptions (REST v1). El pago y los datos de la cuenta/tarjeta se
 * quedan en PayPal: la app sólo recibe el id de la suscripción y su estado.
 */
export const PAYPAL_WEBHOOK_PATH = "/api/paypal/webhook";
const EVENTS = [
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "PAYMENT.SALE.COMPLETED",
];

export function isPaypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

const base = () => (process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");
const cfgKey = (k: string) => `paypal_${process.env.PAYPAL_ENV === "live" ? "live" : "sandbox"}_${k}`;

let token: { value: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return token.value;
}

export async function paypal<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PayPal ${init.method ?? "GET"} ${path} ${res.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

async function getCfg(key: string): Promise<string | null> {
  const { data } = await createAdminClient().rpc("billing_config_get", { p_key: cfgKey(key) });
  return data ?? null;
}
async function setCfg(key: string, value: string) {
  const { error } = await createAdminClient().rpc("billing_config_set", { p_key: cfgKey(key), p_value: value });
  if (error) throw error;
}

/** Producto + plan de 2 €/mes y webhook: se crean solos la primera vez. */
export async function ensurePaypalSetup(): Promise<string> {
  let planId = await getCfg("plan_id");
  if (!planId) {
    const product = await paypal<{ id: string }>("/v1/catalogs/products", {
      method: "POST",
      body: { name: "Winter Arc Pro", type: "SERVICE", category: "SOFTWARE" },
    });
    const plan = await paypal<{ id: string }>("/v1/billing/plans", {
      method: "POST",
      body: {
        product_id: product.id,
        name: "Winter Arc Pro mensual",
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: { interval_unit: "MONTH", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: { fixed_price: { value: "2.00", currency_code: "EUR" } },
          },
        ],
        payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
      },
    });
    planId = plan.id;
    await setCfg("plan_id", planId);
  }
  if (!(await getCfg("webhook_id"))) {
    const url = `${getSiteUrl()}${PAYPAL_WEBHOOK_PATH}`;
    const list = await paypal<{ webhooks: { id: string; url: string }[] }>("/v1/notifications/webhooks");
    const found = list.webhooks.find((w) => w.url === url);
    const id = found
      ? found.id
      : (await paypal<{ id: string }>("/v1/notifications/webhooks", { method: "POST", body: { url, event_types: EVENTS.map((name) => ({ name })) } })).id;
    await setCfg("webhook_id", id);
  }
  return planId;
}

/** Verifica con PayPal que el aviso es auténtico (nadie puede fabricar un pago). */
export async function verifyPaypalWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const webhookId = await getCfg("webhook_id");
  if (!webhookId) return false;
  const h = (k: string) => headers.get(k) ?? "";
  const res = await paypal<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: {
      auth_algo: h("paypal-auth-algo"),
      cert_url: h("paypal-cert-url"),
      transmission_id: h("paypal-transmission-id"),
      transmission_sig: h("paypal-transmission-sig"),
      transmission_time: h("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    },
  });
  return res.verification_status === "SUCCESS";
}

const ACTIVE = ["active", "trialing", "past_due"];

/**
 * ¿Tiene el usuario otra suscripción todavía activa? Evita que un aviso tardío
 * de una suscripción vieja (p. ej. cancelada y sustituida) le quite el Pro.
 */
async function activeElsewhere(userId: string, subId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("subscriptions").select("status, paypal_subscription_id").eq("user_id", userId).maybeSingle();
  return !!data && ACTIVE.includes(data.status) && data.paypal_subscription_id !== subId;
}

export type PaypalSubscription = {
  id: string;
  status: "APPROVAL_PENDING" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
  custom_id?: string;
  billing_info?: { next_billing_time?: string; last_payment?: { time?: string } };
};

/** Copia el estado de PayPal a la BD. Tras cancelar, sigue siendo Pro hasta fin del periodo pagado. */
export async function syncPaypalSubscription(sub: PaypalSubscription): Promise<void> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("subscriptions")
    .select("user_id, current_period_end")
    .eq("paypal_subscription_id", sub.id)
    .maybeSingle();
  const userId = sub.custom_id ?? existing?.user_id;
  if (!userId) {
    logServerError("paypal:sync", new Error("suscripción sin usuario"));
    return;
  }
  const next = sub.billing_info?.next_billing_time ?? null;
  const periodEnd = next ?? existing?.current_period_end ?? null;
  const stillPaid = periodEnd ? new Date(periodEnd).getTime() > Date.now() : false;
  let status: string;
  let cancelAtEnd = false;
  switch (sub.status) {
    case "ACTIVE":
      status = "active";
      break;
    case "CANCELLED":
      status = stillPaid ? "active" : "canceled";
      cancelAtEnd = stillPaid;
      break;
    case "SUSPENDED":
      status = "unpaid";
      break;
    case "EXPIRED":
      status = "canceled";
      break;
    default:
      status = "incomplete";
  }
  if (status !== "active" && (await activeElsewhere(userId, sub.id))) return;
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      provider: "paypal",
      paypal_subscription_id: sub.id,
      status,
      current_period_end: periodEnd,
      cancel_at_period_end: cancelAtEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
