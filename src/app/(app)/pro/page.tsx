import type { Metadata } from "next";
import { CheckCircle2, CreditCard, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { hasFullAccess, requireGroup } from "@/lib/data/session";
import { confirmCheckout } from "@/app/actions/billing";
import { isBillingConfigured } from "@/lib/billing/stripe";
import { formatDateOnly } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CancelButton, SubscribeButton } from "@/components/billing/billing-buttons";

export const metadata: Metadata = { title: "Winter Arc Pro" };

const FEATURES = ["Rangos y score de disciplina", "Grupo, actividad en directo y duelos", "Panel, calendario y progreso", "Entrenamientos y estadísticas completas"];

export default async function ProPage({ searchParams }: PageProps<"/pro">) {
  const params = await searchParams;
  if (params.status === "success" && typeof params.session_id === "string") await confirmCheckout(params.session_id);

  const session = await requireGroup();
  const { supabase, userId, activeGroup, profile } = session;
  const [{ data: sub }, fullAccess] = await Promise.all([
    supabase.from("subscriptions").select("status, current_period_end, cancel_at_period_end").eq("user_id", userId).maybeSingle(),
    hasFullAccess(session),
  ]);
  const active = !!sub && ["active", "trialing", "past_due"].includes(sub.status);
  const isCreator = activeGroup.created_by === userId;
  const nextDate = sub?.current_period_end ? formatDateOnly(sub.current_period_end, profile.timezone) : null;

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <header>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Suscripción</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Winter Arc Pro <Sparkles className="size-6 text-primary" aria-hidden="true" />
        </h1>
      </header>

      {params.status === "success" ? (
        <p className="rounded-2xl border border-success/40 bg-success-soft p-4 text-sm font-medium text-success" role="status">
          ¡Pago completado! Ya eres Pro. Si aún no lo ves, recarga en unos segundos.
        </p>
      ) : null}
      {params.locked && !fullAccess ? (
        <p className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning" role="status">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          «{activeGroup.name}» es una sala Pro. Sin suscripción sólo puedes marcar tus hábitos del día.
        </p>
      ) : null}

      <Card className="aurora">
        <CardContent className="grid gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="tabular text-4xl font-black tracking-tight">
              2 € <span className="text-base font-medium text-muted">/ mes</span>
            </p>
            {active ? <Badge tone="success">Pro activo</Badge> : isCreator && activeGroup.requires_pro ? <Badge tone="primary">Creador: acceso gratis</Badge> : null}
          </div>

          <ul className="grid gap-2 text-sm">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" /> {f}
              </li>
            ))}
          </ul>

          {active ? (
            <div className="grid gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
              {sub.cancel_at_period_end ? (
                <p>
                  Suscripción cancelada. Sigues siendo Pro hasta el <b>{nextDate}</b> y no se te cobrará más.
                </p>
              ) : (
                <p>
                  Próximo cobro: <b>{nextDate}</b> · 2,00 €. Se renueva cada mes el mismo día hasta que canceles.
                </p>
              )}
              {sub.status === "past_due" ? <p className="text-warning">El último cobro falló: Stripe lo reintentará. Revisa tu tarjeta.</p> : null}
              <div>
                <CancelButton resume={sub.cancel_at_period_end} />
              </div>
            </div>
          ) : isBillingConfigured() ? (
            <SubscribeButton />
          ) : (
            <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">Los pagos se están activando. Vuelve en un rato.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-2 text-xs text-muted">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          Pago seguro con Stripe (certificado PCI DSS nivel 1). Tu tarjeta se introduce en la página de Stripe: Winter Arc nunca la ve ni la guarda.
        </p>
        <p className="flex items-start gap-2">
          <CreditCard className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Se cobra cada mes el mismo día en que te suscribiste (p. ej. del 5 de enero al 5 de febrero). Puedes cancelar cuando quieras desde aquí.
        </p>
        <p>Las salas gratuitas siguen siendo gratis. Pro sólo es necesario en salas de pago.</p>
      </div>
    </div>
  );
}
