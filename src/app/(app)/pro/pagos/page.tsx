import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireSession } from "@/lib/data/session";
import { PAYPAL_ME_URL, PRO_MONTH_EUR, PRO_YEAR_EUR } from "@/lib/billing/paypal-me";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProManager, type ProMember } from "@/components/admin/pro-manager";

export const metadata: Metadata = { title: "Pagos Pro" };

export default async function StaffPaymentsPage() {
  const { supabase, profile } = await requireSession();
  const { data: isStaff } = await supabase.rpc("am_i_staff");
  if (!isStaff) notFound();
  const { data } = await supabase.rpc("staff_pro_list");
  const members: ProMember[] = (data ?? []).map((r) => ({
    userId: r.user_id,
    name: r.display_name,
    username: r.username,
    emoji: r.avatar_emoji,
    color: r.avatar_color,
    active: r.active,
    proUntil: r.pro_until,
    trialUntil: r.trial_until,
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
