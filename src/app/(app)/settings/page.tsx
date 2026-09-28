import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSession } from "@/lib/data/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ProfileForm } from "@/components/settings/profile-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { DeleteAccountForm, SignOutButton } from "@/components/settings/account-actions";
import { LeaveGroupButton } from "@/components/admin/danger-zone";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { isEmailConfigured } from "@/lib/email/mailer";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const { supabase, profile, settings, groups, activeGroup, email } = await requireSession();
  const { data: notify } = await supabase.rpc("my_notification_email");
  const n = notify?.[0];
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Ajustes</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tu cuenta</h1>
          <p className="text-sm text-muted break-all">{email}</p>
        </div>
        <SignOutButton />
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={profile} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Privacidad y recordatorios</CardTitle>
          </CardHeader>
          <CardContent>
            <PreferencesForm settings={settings} />
          </CardContent>
        </Card>
      </div>

      <Card id="notificaciones">
        <CardHeader>
          <div>
            <CardTitle className="text-base">Notificaciones por email</CardTitle>
            <CardDescription>Recordatorios y resumen semanal con tus estadísticas y las de tu grupo.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <NotificationsForm
            state={{
              accountEmail: n?.account_email ?? email,
              accountConfirmed: n?.account_confirmed ?? false,
              customEmail: n?.notification_email ?? null,
              customVerified: n?.verified ?? false,
              pendingEmail: n?.pending_email ?? null,
              daily: settings.email_daily_reminder,
              weekly: settings.email_weekly_summary,
              reminderTime: settings.reminder_time,
              emailConfigured: isEmailConfigured(),
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apariencia</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base">Mis grupos</CardTitle>
            <CardDescription>Puedes pertenecer a varios grupos y cambiar entre ellos desde la cabecera.</CardDescription>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link href="/onboarding">
              <Plus aria-hidden="true" /> Crear o unirme
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted">Aún no perteneces a ningún grupo.</p>
          ) : (
            <ul className="grid gap-2">
              {groups.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{g.name}</p>
                    <p className="text-xs text-muted">
                      {g.start_date} → {g.end_date}
                    </p>
                  </div>
                  {g.id === activeGroup?.id ? <Badge tone="primary">Activo</Badge> : null}
                  {g.role === "admin" ? <Badge>Admin</Badge> : null}
                  <LeaveGroupButton groupId={g.id} groupName={g.name} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-danger/40">
        <CardHeader>
          <div>
            <CardTitle className="text-base text-danger">Eliminar cuenta</CardTitle>
            <CardDescription>
              Se borran tu perfil, registros, notas y entrenamientos de forma permanente. Si eres el único admin de un grupo, la administración pasa al miembro más antiguo.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
