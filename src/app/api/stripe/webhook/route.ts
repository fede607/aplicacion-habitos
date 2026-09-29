import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, getWebhookSecret, isBillingConfigured, syncSubscription } from "@/lib/billing/stripe";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Webhook de Stripe. Sólo se acepta si la firma es válida (secreto compartido
 * con Stripe), así nadie puede fabricar un "pago" llamando a esta URL.
 */
export async function POST(request: NextRequest) {
  if (!isBillingConfigured()) return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  const secret = await getWebhookSecret();
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "unauthorized" }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      case "checkout.session.completed": {
        const s = event.data.object;
        if (s.mode === "subscription" && s.subscription) {
          const id = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
          await syncSubscription(await stripe.subscriptions.retrieve(id));
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const subRef = event.data.object.parent?.subscription_details?.subscription;
        if (subRef) {
          const id = typeof subRef === "string" ? subRef : subRef.id;
          await syncSubscription(await stripe.subscriptions.retrieve(id));
        }
        break;
      }
    }
  } catch (e) {
    logServerError(`stripe:webhook:${event.type}`, e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
