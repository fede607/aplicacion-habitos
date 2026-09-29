import { NextResponse, type NextRequest } from "next/server";
import { isPaypalConfigured, paypal, syncPaypalSubscription, verifyPaypalWebhook, type PaypalSubscription } from "@/lib/billing/paypal";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";

type PaypalEvent = { event_type?: string; resource?: { id?: string; billing_agreement_id?: string } };

/**
 * Webhook de PayPal. Se verifica la firma con PayPal y, además, el estado se
 * vuelve a pedir a PayPal por id: nunca se confía en el cuerpo del aviso.
 */
export async function POST(request: NextRequest) {
  if (!isPaypalConfigured()) return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  let event: PaypalEvent;
  try {
    event = (await request.json()) as PaypalEvent;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    if (!(await verifyPaypalWebhook(request.headers, event))) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    const type = event.event_type ?? "";
    const subId = type.startsWith("BILLING.SUBSCRIPTION.") ? event.resource?.id : type === "PAYMENT.SALE.COMPLETED" ? event.resource?.billing_agreement_id : undefined;
    if (subId && /^I-[A-Z0-9]+$/.test(subId)) {
      await syncPaypalSubscription(await paypal<PaypalSubscription>(`/v1/billing/subscriptions/${subId}`));
    }
  } catch (e) {
    logServerError("paypal:webhook", e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
