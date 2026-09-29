-- =============================================================================
-- Winter Arc Pro: segundo proveedor de pago (PayPal Subscriptions).
-- Una fila por usuario; `provider` indica si la suscripción es de Stripe o PayPal.
-- =============================================================================
alter table public.subscriptions
  add column provider text not null default 'stripe' check (provider in ('stripe', 'paypal')),
  add column paypal_subscription_id text unique,
  alter column stripe_customer_id drop not null;
