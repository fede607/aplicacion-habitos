import Link from "next/link";
import { Medal } from "lucide-react";
import { requireSession } from "@/lib/data/session";
import { Avatar } from "@/components/ui/avatar";
import { BottomNav, SidebarNav } from "@/components/layout/app-nav";
import { GroupSwitcher } from "@/components/layout/group-switcher";
import { GroupTabs } from "@/components/layout/group-tabs";
import { Logo } from "@/components/layout/logo";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { TimezoneMismatch } from "@/components/layout/timezone-mismatch";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { profile, groups, activeGroup } = session;
  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-surface p-4 lg:flex">
        <Link href="/today" className="px-2 pt-2" aria-label="Winter Arc, inicio">
          <Logo />
        </Link>
        {activeGroup ? (
          <div className="rounded-xl bg-surface-2 px-3 py-2">
            <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Grupo</p>
            <p className="truncate text-sm font-semibold">{activeGroup.name}</p>
          </div>
        ) : null}
        <SidebarNav />
        <Link
          href="/settings"
          className="mt-auto flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2"
        >
          <Avatar name={profile.display_name} emoji={profile.avatar_emoji} color={profile.avatar_color} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{profile.display_name}</span>
            <span className="block truncate text-xs text-muted">@{profile.username}</span>
          </span>
        </Link>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="pt-safe sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-lg">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
            <Link href="/today" className="lg:hidden" aria-label="Winter Arc, inicio">
              <Logo className="[&_span]:text-base" />
            </Link>
            <div className="hidden truncate text-sm text-muted lg:block">
              {activeGroup ? activeGroup.name : "Sin grupo"}
            </div>
            <div className="flex items-center gap-2">
              <GroupSwitcher groups={groupOptions} activeId={activeGroup?.id ?? null} />
              <Link
                href="/rank"
                aria-label="Rango"
                className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground lg:hidden"
              >
                <Medal className="size-5" aria-hidden="true" />
              </Link>
              <Link
                href="/progress"
                className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground lg:hidden"
              >
                Progreso
              </Link>
              <Link href="/settings" aria-label="Ajustes y perfil" className="rounded-full lg:hidden">
                <Avatar name={profile.display_name} emoji={profile.avatar_emoji} color={profile.avatar_color} size="sm" />
              </Link>
            </div>
          </div>
          <OfflineBanner />
          <TimezoneMismatch profileTimezone={profile.timezone} />
        </header>

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 sm:px-6 lg:pb-12">
          {groups.length > 1 ? (
            <div className="mb-5">
              <GroupTabs groups={groupOptions} activeId={activeGroup?.id ?? null} />
            </div>
          ) : null}
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
