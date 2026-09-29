"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, logServerError, type ActionResult } from "@/lib/errors";
import { ensureWebhook, getStripe, isBillingConfigured, PRO_CURRENCY, PRO_PRICE_CENTS, syncSubscription } from "@/lib/billing/stripe";
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

async function setCancel(cancel: boolean): Promise<ActionResult> {
  if (!isBillingConfigured()) return NOT_READY;
  const { userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const sub = await mySubscription(userId);
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
