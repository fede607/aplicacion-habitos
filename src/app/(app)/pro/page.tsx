import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CreditCard, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { hasFullAccess, requireGroup } from "@/lib/data/session";
import { confirmPaypal } from "@/app/actions/billing";
import { isPaypalConfigured } from "@/lib/billing/paypal";
import { PAYMENTS_OPEN, PAYPAL_ME_PAY_URL, PAYPAL_ME_YEAR_URL, PRO_MONTH_EUR, PRO_YEAR_EUR } from "@/lib/billing/paypal-me";
import { buttonVariants } from "@/components/ui/button";
import { formatDateOnly } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CancelButton, SubscribeButton } from "@/components/billing/billing-buttons";
import { ReviewsShowcase } from "@/components/reviews/social-proof";
import { getPublicProof } from "@/lib/data/public-proof";

export const metadata: Metadata = { title: "Year Arc Pro" };

const FEATURES = [
  "Plan de entrenamiento personalizado a tu físico y objetivo",
  "Analíticas avanzadas: mes a mes, patrones y exportar tus datos",
  "Rangos y score de disciplina",
  "Panel, calendario, progreso y entrenamientos",
  "Insignia y marco Pro exclusivos en tu grupo",
  "Hasta 10 grupos propios (sin Pro, 1)",
];

export default async function ProPage({ searchParams }: PageProps<"/pro">) {
  const params = await searchParams;
  if (params.paypal === "success" && typeof params.subscription_id === "string") await confirmPaypal(params.subscription_id);
  const paid = params.paypal === "success";
  const paypalOn = isPaypalConfigured();

  const session = await requireGroup();
  const { supabase, userId, activeGroup, profile } = session;
  const [{ data: sub }, fullAccess, { data: trialEnd }, { data: isStaff }, { data: lifetime }, proof] = await Promise.all([
    supabase.from("subscriptions").select("status, current_period_end, cancel_at_period_end, paypal_subscription_id").eq("user_id", userId).maybeSingle(),
    hasFullAccess(session),
    supabase.rpc("my_pro_trial_end"),
    supabase.rpc("am_i_staff"),
    supabase.rpc("my_pro_lifetime"),
    getPublicProof(),
  ]);
  const active = !!sub && ["active", "trialing", "past_due"].includes(sub.status);
  const nextDate = sub?.current_period_end ? formatDateOnly(sub.current_period_end, profile.timezone) : null;
  const manual = active && !sub.paypal_subscription_id;
  const now = new Date();
  const trialDate = trialEnd ? formatDateOnly(trialEnd, profile.timezone) : null;
  const onTrial = !lifetime && !active && !!trialEnd && new Date(trialEnd) > now;
  const trialOver = !lifetime && !active && !!trialEnd && new Date(trialEnd) <= now;

  const paypalMe = (
    <div className="grid gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
      <a href={PAYPAL_ME_YEAR_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "pro", size: "xl", className: "relative w-full" })}>
        <Sparkles aria-hidden="true" /> Year Pro · {PRO_YEAR_EUR} € al año
        <span className="absolute -top-2.5 right-3 rounded-full bg-success px-2 py-0.5 text-[11px] font-bold text-white">2 meses gratis</span>
      </a>
      <a href={PAYPAL_ME_PAY_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}>
        {manual ? `Renovar 1 mes · ${PRO_MONTH_EUR} €` : `Mensual · ${PRO_MONTH_EUR} € al mes`}
      </a>
      <ol className="grid list-decimal gap-1 pl-5 text-muted">
        <li>
          Paga por PayPal y escribe en la nota tu usuario: <b className="text-foreground">@{profile.username}</b>
        </li>
        <li>Activamos tu Pro en cuanto llega el pago (normalmente el mismo día).</li>
        <li>
          {PRO_MONTH_EUR} € = 1 mes · {PRO_YEAR_EUR} € = 1 año{onTrial ? ", que empiezan cuando acabe tu mes gratis" : ""}. Si no renuevas, vuelves a la versión gratis
          (tus hábitos, tu línea del año y grupos).
        </li>
      </ol>
    </div>
  );

  // Con PayPal configurado: suscripción automática (sin nada que hacer a mano). Si no, PayPal.me.
  const payBox = !PAYMENTS_OPEN ? (
    <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">
      Pro todavía no se puede comprar: Year Arc está en acceso privado. Cuando abramos la venta te avisaremos antes de cobrar nada.
    </p>
  ) : paypalOn ? (
    <div className="grid gap-3">
      <SubscribeButton period="year" label={`Year Pro · ${PRO_YEAR_EUR} € al año (2 meses gratis)`} />
      <SubscribeButton period="month" label={`Mensual · ${PRO_MONTH_EUR} € al mes`} />
      <p className="text-xs text-muted">
        Se renueva sola hasta que canceles.{onTrial || manual ? " El primer cobro llega cuando se acabe el Pro que ya tienes: no pierdes días." : ""}
      </p>
    </div>
  ) : (
    paypalMe
  );

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <header>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Suscripción</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Year Arc Pro <Sparkles className="size-6 text-primary" aria-hidden="true" />
        </h1>
      </header>

      {paid ? (
        <p className="rounded-2xl border border-success/40 bg-success-soft p-4 text-sm font-medium text-success" role="status">
          ¡Pago completado! Ya eres Pro. Si aún no lo ves, recarga en unos segundos.
        </p>
      ) : null}
      {trialOver && !fullAccess ? (
        <p className="rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning" role="status">
          Tu mes gratis de Pro terminó el {trialDate}.{PAYMENTS_OPEN ? ` Para seguir con Pro: ${PRO_MONTH_EUR} € al mes o ${PRO_YEAR_EUR} € al año.` : ""}
        </p>
      ) : null}
      {params.locked && !fullAccess ? (
        <p className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning" role="status">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          «{activeGroup.name}» incluye Pro. Sin Pro puedes crear y marcar tus hábitos, ver tu línea del año y el grupo.
        </p>
      ) : null}

      <Card className="aurora">
        <CardContent className="grid gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            {PAYMENTS_OPEN ? (
              <p className="tabular text-4xl font-black tracking-tight">
                {PRO_MONTH_EUR} € <span className="text-base font-medium text-muted">/ mes · o {PRO_YEAR_EUR} € / año</span>
              </p>
            ) : (
              <p className="text-2xl font-black tracking-tight">Year Arc Pro</p>
            )}
            {lifetime ? <Badge tone="success">Pro para siempre</Badge> : active ? <Badge tone="success">Pro activo</Badge> : onTrial ? <Badge tone="success">Mes gratis</Badge> : isStaff ? <Badge tone="primary">Propietario: acceso total</Badge> : null}
          </div>

          <ul className="grid gap-2 text-sm">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" /> {f}
              </li>
            ))}
          </ul>

          {isStaff ? (
            <div className="grid gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
              <p>Eres el propietario de Year Arc: tienes todo gratis. Cuando alguien te pague, actívale el Pro desde tu panel de pagos.</p>
              <Link href="/pro/pagos" className={buttonVariants({ variant: "pro", size: "xl", className: "w-full" })}>
                <Sparkles aria-hidden="true" /> Gestionar pagos Pro
              </Link>
            </div>
          ) : lifetime ? (
            <p className="rounded-2xl border border-success/40 bg-success-soft p-4 text-sm text-foreground">
              ⭐ <b>Tienes Pro para siempre</b>, regalo de Year Arc. No tienes que pagar nada nunca.
            </p>
          ) : onTrial ? (
            <>
              <p className="rounded-2xl border border-success/40 bg-success-soft p-4 text-sm text-foreground">
                🎁 <b>Tienes Pro gratis hasta el {trialDate}.</b>{" "}
                {PAYMENTS_OPEN ? (
                  <>
                    Cuando acabe, si quieres seguir con Pro son <b>{PRO_MONTH_EUR} € al mes</b> o <b>{PRO_YEAR_EUR} € al año</b>. Si no pagas, sigues con la versión gratis (tus
                    hábitos, tu línea del año y grupos).
                  </>
                ) : (
                  "Después sigues con la versión gratis (tus hábitos, tu línea del año y grupos)."
                )}
              </p>
              {payBox}
            </>
          ) : manual ? (
            <>
              <p className="rounded-2xl bg-surface-2 p-4 text-sm">
                Pro pagado hasta el <b>{nextDate}</b>. Para seguir siendo Pro, renueva antes de esa fecha.
              </p>
              {payBox}
            </>
          ) : active ? (
            <div className="grid gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
              {sub.cancel_at_period_end ? (
                <p>
                  Suscripción cancelada. Sigues siendo Pro hasta el <b>{nextDate}</b> y no se te cobrará más.
                </p>
              ) : (
                <p>
                  Próxima renovación: <b>{nextDate}</b>. Se renueva sola (mensual o anual, según tu plan) hasta que canceles.
                </p>
              )}
              {sub.status === "past_due" ? <p className="text-warning">El último cobro falló: se reintentará. Revisa tu método de pago.</p> : null}
              {sub.cancel_at_period_end ? null : (
                <div>
                  <CancelButton />
                </div>
              )}
            </div>
          ) : (
            payBox
          )}
        </CardContent>
      </Card>

      <ReviewsShowcase stats={proof.stats} reviews={proof.reviews} title="Opiniones de quienes ya lo usan" />

      <div className="grid gap-2 text-xs text-muted">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          Pago seguro con PayPal (certificado PCI DSS nivel 1). Pagas en la página de PayPal: Year Arc nunca ve ni guarda tu cuenta ni tu tarjeta.
        </p>
        <p className="flex items-start gap-2">
          <CreditCard className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {paypalOn
            ? "Se cobra cada mes el mismo día en que te suscribiste (p. ej. del 5 de enero al 5 de febrero). Puedes cancelar cuando quieras desde aquí o desde tu cuenta de PayPal."
            : "Pagas por adelantado (1 mes o 1 año): no hay cobros automáticos ni nada que cancelar. Si no renuevas, vuelves a la versión gratis (tus hábitos, tu línea del año y grupos)."}
        </p>
        <p>Cada persona tiene 1 mes de Pro gratis al entrar en su primer grupo de pago. Las salas gratuitas siguen siendo gratis.</p>
      </div>
    </div>
  );
}
