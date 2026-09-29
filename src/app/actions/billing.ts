"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, logServerError, type ActionResult } from "@/lib/errors";
import { ensureWebhook, getStripe, isBillingConfigured, PRO_CURRENCY, PRO_PRICE_CENTS, syncSubscription } from "@/lib/billing/stripe";
import { ensurePaypalSetup, isPaypalConfigured, paypal, syncPaypalSubscription, type PaypalSubscription } from "@/lib/billing/paypal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/env";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

const NOT_READY = { ok: false as const, error: "Los pagos aún no están activados. Inténtalo más tarde." };

async function mySubscription(userId: string) {
  const { data } = await createAdminClient().from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  return data;
}

/** Abre Stripe Checkout (2 €/mes). La tarjeta se introduce sólo en Stripe. */
export async function startCheckout(): Promise<ActionResult<never>> {
  if (!isBillingConfigured()) return NOT_READY;
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { data: claims } = await supabase.auth.getClaims();
  const email = String(claims?.claims?.email ?? "") || undefined;

  let url: string | null = null;
  try {
    await ensureWebhook();
    const stripe = getStripe();
    const existing = await mySubscription(userId);
    if (existing && ["active", "trialing", "past_due"].includes(existing.status)) redirect("/pro");

    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
      customerId = customer.id;
      const { error } = await createAdminClient()
        .from("subscriptions")
        .upsert({ user_id: userId, stripe_customer_id: customerId, status: "incomplete" }, { onConflict: "user_id" });
      if (error) throw error;
    }
    const site = getSiteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      locale: "es",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: PRO_CURRENCY,
            unit_amount: PRO_PRICE_CENTS,
            recurring: { interval: "month" },
            product_data: { name: "Winter Arc Pro", description: "Rangos, grupo, duelos y estadísticas completas" },
          },
        },
      ],
      subscription_data: { metadata: { user_id: userId } },
      success_url: `${site}/pro?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/pro?status=cancelled`,
    });
    url = session.url;
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect()
    logServerError("startCheckout", e);
    return { ok: false, error: "No se ha podido abrir el pago. Inténtalo de nuevo." };
  }
  if (!url) return { ok: false, error: "No se ha podido abrir el pago." };
  redirect(url);
}

/** Tras volver de Checkout: confirma el pago con Stripe (no se fía de la URL). */
export async function confirmCheckout(sessionId: string): Promise<void> {
  if (!isBillingConfigured() || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return;
  const { userId } = await authed();
  if (!userId) return;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== userId || !session.subscription) return;
    const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    await syncSubscription(await stripe.subscriptions.retrieve(id));
  } catch (e) {
    logServerError("confirmCheckout", e);
  }
}

/** Abre PayPal para aprobar la suscripción de 2 €/mes (la cuenta/tarjeta sólo la ve PayPal). */
export async function startPaypalCheckout(): Promise<ActionResult<never>> {
  if (!isPaypalConfigured()) return NOT_READY;
  const { userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;

  let url: string | undefined;
  try {
    const existing = await mySubscription(userId);
    if (existing && ["active", "trialing", "past_due"].includes(existing.status)) redirect("/pro");
    const planId = await ensurePaypalSetup();
    const site = getSiteUrl();
    const sub = await paypal<{ links: { rel: string; href: string }[] }>("/v1/billing/subscriptions", {
      method: "POST",
      body: {
        plan_id: planId,
        custom_id: userId,
        application_context: {
          brand_name: "Winter Arc",
          locale: "es-ES",
          user_action: "SUBSCRIBE_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: `${site}/pro?paypal=success`,
          cancel_url: `${site}/pro?status=cancelled`,
        },
      },
    });
    url = sub.links.find((l) => l.rel === "approve")?.href;
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect()
    logServerError("startPaypalCheckout", e);
    return { ok: false, error: "No se ha podido abrir PayPal. Inténtalo de nuevo." };
  }
  if (!url) return { ok: false, error: "No se ha podido abrir PayPal." };
  redirect(url);
}

/** Tras volver de PayPal: consulta la suscripción a PayPal y comprueba que es de este usuario. */
export async function confirmPaypal(subscriptionId: string): Promise<void> {
  if (!isPaypalConfigured() || !/^I-[A-Z0-9]+$/.test(subscriptionId)) return;
  const { userId } = await authed();
  if (!userId) return;
  try {
    const sub = await paypal<PaypalSubscription>(`/v1/billing/subscriptions/${subscriptionId}`);
    if (sub.custom_id !== userId) return;
    await syncPaypalSubscription(sub);
  } catch (e) {
    logServerError("confirmPaypal", e);
  }
}

async function setCancel(cancel: boolean): Promise<ActionResult> {
  const { userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const sub = await mySubscription(userId);
  if (sub?.provider === "paypal" && sub.paypal_subscription_id) {
    if (!cancel) return { ok: false, error: "Las suscripciones de PayPal no se pueden reactivar: suscríbete de nuevo cuando termine el periodo." };
    if (!isPaypalConfigured()) return NOT_READY;
    try {
      await paypal(`/v1/billing/subscriptions/${sub.paypal_subscription_id}/cancel`, { method: "POST", body: { reason: "Cancelada por el usuario" } });
      await syncPaypalSubscription(await paypal<PaypalSubscription>(`/v1/billing/subscriptions/${sub.paypal_subscription_id}`));
    } catch (e) {
      return fail({ message: e instanceof Error ? e.message : "paypal" }, "setCancel", "No se ha podido cancelar la suscripción.");
    }
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  }
  if (!isBillingConfigured()) return NOT_READY;
  if (!sub?.stripe_subscription_id) return { ok: false, error: "No tienes una suscripción activa." };
  try {
    const updated = await getStripe().subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: cancel });
    await syncSubscription(updated);
  } catch (e) {
    return fail({ message: e instanceof Error ? e.message : "stripe" }, "setCancel", "No se ha podido actualizar la suscripción.");
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Cancela al final del periodo pagado (sigues siendo Pro hasta esa fecha). */
export async function cancelSubscription(): Promise<ActionResult> {
  return setCancel(true);
}

export async function resumeSubscription(): Promise<ActionResult> {
  return setCancel(false);
}
