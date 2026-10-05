import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireSession } from "@/lib/data/session";
import { PAYPAL_ME_URL, PRO_MONTH_EUR, PRO_YEAR_EUR } from "@/lib/billing/paypal-me";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProManager, type ProMember } from "@/components/admin/pro-manager";
import { ReviewsManager } from "@/components/admin/reviews-manager";
import { AccessManager, type AccessCode } from "@/components/admin/access-manager";
import { PaymentsSwitch } from "@/components/admin/payments-switch";
import { getPaymentsOpen } from "@/lib/billing/payments";

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
  const { data: sources } = await supabase.rpc("staff_signup_sources");
  const [{ data: inviteOnly }, { data: codeRows }, paymentsOpen] = await Promise.all([supabase.rpc("signup_is_invite_only"), supabase.rpc("staff_access_codes"), getPaymentsOpen()]);
  const codes: AccessCode[] = (codeRows ?? []).map((c) => ({
    code: c.code,
    note: c.note,
    expiresAt: c.expires_at,
    usedAt: c.used_at,
    usedBy: c.used_username,
    revoked: c.revoked,
  }));
  const reviews = (reviewRows ?? []).map((r) => ({
    id: r.id,
    username: r.username,
    name: r.display_name,
    rating: r.rating,
    body: r.body,
    allowPublic: r.allow_public,
    approved: r.approved,
  }));
  const pendingReviews = reviews.filter((r) => !r.approved && r.allowPublic && r.rating >= 4 && r.body.trim()).length;
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
      <PaymentsSwitch open={paymentsOpen} />
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base">Invitaciones de acceso</CardTitle>
            <CardDescription>
              Cada enlace sirve para crear una sola cuenta y caduca en 14 días. Si alguien lo reenvía, sólo podrá usarlo la primera persona.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <AccessManager inviteOnly={!!inviteOnly} codes={codes} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base">Opiniones de usuarios {pendingReviews ? <span className="ml-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-black">{pendingReviews} por revisar</span> : null}</CardTitle>
            <CardDescription>
              Sólo aparecen en la web las que tú publiques, y sólo si su autor ha dado permiso. Si la edita, vuelve a revisión.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ReviewsManager reviews={reviews} />
        </CardContent>
      </Card>

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
            <CardTitle className="text-base">¿De dónde vienen los registros?</CardTitle>
            <CardDescription>
              Comparte <b>winterarc-2026.vercel.app/w</b> en tus estados (o <b>/w?s=instagram</b>, <b>/w?s=tiktok</b>…). Imágenes y textos listos en{" "}
              <Link href="/promo" className="font-medium text-primary underline">
                /promo
              </Link>
              .
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {(sources ?? []).length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1 font-medium">Origen</th>
                  <th className="py-1 text-right font-medium">Últimos 30 días</th>
                  <th className="py-1 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {sources!.map((r) => (
                  <tr key={r.source} className="border-t border-border">
                    <td className="py-2 font-semibold">{r.source}</td>
                    <td className="tabular py-2 text-right">{r.last_30d}</td>
                    <td className="tabular py-2 text-right">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">Aún no hay registros.</p>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
