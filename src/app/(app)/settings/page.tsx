import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ChevronDown, ChevronRight, Mail, Palette, Plus, ShieldCheck, Smartphone, Sparkles, Trash2, UserRound, Users } from "lucide-react";
import { requireSession } from "@/lib/data/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InstallAppCard } from "@/components/pwa/install-app";
import { PushToggle } from "@/components/pwa/push-toggle";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ProfileForm } from "@/components/settings/profile-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { DeleteAccountForm, SignOutButton } from "@/components/settings/account-actions";
import { LeaveGroupButton } from "@/components/admin/danger-zone";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { isEmailConfigured } from "@/lib/email/mailer";

export const metadata: Metadata = { title: "Perfil" };

export default async function SettingsPage() {
  const { supabase, profile, settings, groups, activeGroup, email } = await requireSession();
  const { data: notify } = await supabase.rpc("my_notification_email");
  const n = notify?.[0];
  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <header className="flex items-center gap-4">
        <Avatar name={profile.display_name} emoji={profile.avatar_emoji} color={profile.avatar_color} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black tracking-tight">{profile.display_name}</h1>
          <p className="truncate text-sm text-muted">@{profile.username}</p>
        </div>
        <SignOutButton />
      </header>

      <Link
        href="/pro"
        className="aurora flex items-center gap-3 rounded-3xl border border-primary/30 bg-surface p-4 shadow-card transition-transform active:scale-[0.99]"
      >
        <span className="pro-gradient grid size-11 shrink-0 place-items-center rounded-2xl">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Year Arc Pro</span>
          <span className="block text-sm text-muted">Tu plan, estado de suscripción e invitar amigos</span>
        </span>
        <ChevronRight className="size-5 text-muted" aria-hidden="true" />
      </Link>

      <div className="grid gap-2">
        <Section icon={<UserRound />} title="Editar perfil" hint="Nombre, avatar y color">
          <ProfileForm profile={profile} />
        </Section>
        <Section icon={<Users />} title="Mis grupos" hint={`${groups.length} ${groups.length === 1 ? "grupo" : "grupos"}`}>
          <div className="grid gap-3">
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
            <Button asChild variant="secondary">
              <Link href="/group">
                <Plus aria-hidden="true" /> Crear o unirme a un grupo
              </Link>
            </Button>
          </div>
        </Section>
        <Section icon={<Smartphone />} title="App en tu móvil" hint="Instálala en la pantalla de inicio">
          <InstallAppCard />
        </Section>
        <Section icon={<Bell />} title="Avisos push" hint="Recordatorio si te quedan hábitos">
          <PushToggle />
        </Section>
        <Section icon={<Mail />} title="Emails" hint="Recordatorio diario y resumen semanal">
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
        </Section>
        <Section icon={<ShieldCheck />} title="Privacidad y recordatorios" hint="Quién ve tus datos">
          <PreferencesForm settings={settings} />
        </Section>
        <Section icon={<Palette />} title="Apariencia" hint="Claro, oscuro o automático">
          <ThemeToggle />
        </Section>
        <Section icon={<Trash2 />} title="Eliminar cuenta" hint={email ?? ""} danger>
          <p className="mb-3 text-sm text-muted">
            Se borran tu perfil, registros, notas y entrenamientos de forma permanente. Si eres el único admin de un grupo, la administración pasa al miembro
            más antiguo.
          </p>
          <DeleteAccountForm />
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  hint,
  danger,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-5 ${danger ? "bg-danger-soft text-danger" : "bg-surface-2 text-foreground"}`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold ${danger ? "text-danger" : ""}`}>{title}</span>
          {hint ? <span className="block truncate text-xs text-muted">{hint}</span> : null}
        </span>
        <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-border p-4">{children}</div>
    </details>
  );
}
