"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, logServerError, type ActionResult } from "@/lib/errors";
import { ensurePaypalSetup, isPaypalConfigured, paypal, syncPaypalSubscription, type PaypalSubscription } from "@/lib/billing/paypal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/env";
import { authed, NOT_AUTHENTICATED } from "./_helpers";

const NOT_READY = { ok: false as const, error: "Los pagos aún no están activados. Inténtalo más tarde." };

async function mySubscription(userId: string) {
  const { data } = await createAdminClient().from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  return data;
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
          brand_name: "Year Arc",
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

/** Cancela en PayPal. Sigues siendo Pro hasta el final del mes ya pagado y no se cobra más. */
export async function cancelSubscription(): Promise<ActionResult> {
  if (!isPaypalConfigured()) return NOT_READY;
  const { userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const sub = await mySubscription(userId);
  if (!sub?.paypal_subscription_id) return { ok: false, error: "No tienes una suscripción activa." };
  try {
    await paypal(`/v1/billing/subscriptions/${sub.paypal_subscription_id}/cancel`, { method: "POST", body: { reason: "Cancelada por el usuario" } });
    await syncPaypalSubscription(await paypal<PaypalSubscription>(`/v1/billing/subscriptions/${sub.paypal_subscription_id}`));
  } catch (e) {
    return fail({ message: e instanceof Error ? e.message : "paypal" }, "cancelSubscription", "No se ha podido cancelar la suscripción.");
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Sólo el propietario de Year Arc (staff) activa Pro a quien le ha pagado por
 * PayPal.me: 1 = un mes, 12 = un año, 0 = quitar. La BD comprueba que es staff.
 */
export async function staffGrantPro(input: { userId: string; months: 0 | 1 | 12 }): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(input.userId) || ![0, 1, 12].includes(input.months)) return { ok: false, error: "Datos no válidos." };
  const { supabase, userId } = await authed();
  if (!userId) return NOT_AUTHENTICATED;
  const { error } = await supabase.rpc("staff_grant_pro", { p_user_id: input.userId, p_months: input.months });
  if (error) return fail(error, "staffGrantPro");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
