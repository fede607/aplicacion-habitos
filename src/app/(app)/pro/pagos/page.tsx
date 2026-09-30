import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireSession } from "@/lib/data/session";
import { PAYPAL_ME_URL, PRO_MONTH_EUR, PRO_YEAR_EUR } from "@/lib/billing/paypal-me";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProManager, type ProMember } from "@/components/admin/pro-manager";
import { ReviewsManager } from "@/components/admin/reviews-manager";

export const metadata: Metadata = { title: "Pagos Pro" };

export default async function StaffPaymentsPage() {
  const { supabase, profile } = await requireSession();
  const { data: isStaff } = await supabase.rpc("am_i_staff");
  if (!isStaff) notFound();
  const [{ data }, { data: metricsRows }, { data: reviewRows }] = await Promise.all([
    supabase.rpc("staff_pro_list"),
    supabase.rpc("staff_metrics"),
    supabase.rpc("staff_reviews"),
  ]);
  const reviews = (reviewRows ?? []).map((r) => ({
    id: r.id,
    username: r.username,
    name: r.display_name,
    rating: r.rating,
    body: r.body,
    allowPublic: r.allow_public,
    approved: r.approved,
  }));
  const m = metricsRows?.[0];
  const members: ProMember[] = (data ?? []).map((r) => ({
    userId: r.user_id,
    name: r.display_name,
    username: r.username,
    emoji: r.avatar_emoji,
    color: r.avatar_color,
    active: r.active,
    proUntil: r.pro_until,
    trialUntil: r.trial_until,
    lifetime: r.lifetime,
  }));
  const proCount = members.filter((m) => m.active).length;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header>
        <Link href="/pro" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden="true" /> Pro
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Pagos Pro</h1>
        <p className="text-sm text-muted">
          {members.length} usuarios · {proCount} con Pro ahora mismo
        </p>
      </header>
      {m ? (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Métricas">
          {[
            ["Usuarios", m.users, ""],
            ["Activos hoy", m.active_today, `${m.users ? Math.round((m.active_today / m.users) * 100) : 0}%`],
            ["Activos 7 días", m.active_7d, `${m.users ? Math.round((m.active_7d / m.users) * 100) : 0}%`],
            ["Pro activado (pago)", m.paid, "manual o automático"],
            ["En prueba gratis", m.on_trial, ""],
            ["Prueba acaba ≤7 días", m.trials_ending_7d, m.trials_ending_7d ? "¡avísales!" : ""],
            ["Versión gratis", m.free_only, ""],
            ["Pro para siempre", m.lifetime, ""],
            ["Móviles con avisos", m.push_devices, ""],
            ["Amigos invitados", m.referrals, ""],
          ].map(([label, value, sub]) => (
            <div key={String(label)} className="rounded-2xl border border-border bg-surface p-3">
              <p className="text-[11px] text-muted">{label}</p>
              <p className="tabular text-2xl font-bold">{value}</p>
              {sub ? <p className="text-[11px] text-muted">{sub}</p> : null}
            </div>
          ))}
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base">Activar Pro tras un pago</CardTitle>
            <CardDescription>
              Cuando te llegue un pago a{" "}
              <a href={PAYPAL_ME_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">
                tu PayPal.me
              </a>{" "}
              ({PRO_MONTH_EUR} € = 1 mes, {PRO_YEAR_EUR} € = 1 año), busca el @usuario de la nota y pulsa el botón. Si aún está en su mes gratis, se
              suma al final. Sólo tú ves esta página.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ProManager members={members} timeZone={profile.timezone} nowMs={new Date().getTime()} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base">Opiniones de usuarios</CardTitle>
            <CardDescription>
              Sólo aparecen en la web las que tú publiques, y sólo si su autor ha dado permiso. Si la edita, vuelve a revisión.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ReviewsManager reviews={reviews} />
        </CardContent>
      </Card>
    </div>
  );
}
