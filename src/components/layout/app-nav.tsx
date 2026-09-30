"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { isActivePath, NAV_ITEMS, SECTION_TABS } from "./nav-items";

const target = (href: string, free: boolean | undefined, locked: boolean) =>
  locked && !free ? "/pro?locked=1" : href;
const isActive = (pathname: string, match: string[]) =>
  match.some((m) => isActivePath(pathname, m));

export function SidebarNav({ locked = false }: { locked?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="grid gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, free, match }) => {
        const active = isActive(pathname, match.length ? match : [href]);
        return (
          <Link
            key={href}
            href={target(href, free, locked)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-foreground",
              active &&
                "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
            {locked && !free ? (
              <Lock className="ml-auto size-3.5 text-muted" aria-label="Pro" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ locked = false }: { locked?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-lg lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV_ITEMS.filter((i) => i.mobile).map(
          ({ href, label, icon: Icon, free, match }) => {
            const active = isActive(pathname, match);
            return (
              <li key={href}>
                <Link
                  href={target(href, free, locked)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted transition-colors",
                    active && "text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "relative grid h-8 w-14 place-items-center rounded-full transition-colors",
                      active && "bg-primary-soft",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[22px]",
                        locked && !free && "opacity-50",
                      )}
                      strokeWidth={active ? 2.5 : 2}
                      aria-hidden="true"
                    />
                    {locked && !free ? (
                      <Lock
                        className="absolute right-2.5 -bottom-0.5 size-3 text-muted"
                        aria-label="Pro"
                      />
                    ) : null}
                  </span>
                  {label}
                </Link>
              </li>
            );
          },
        )}
      </ul>
    </nav>
  );
}

/** Pestañas de sección (Entreno: plan/registro · Progreso: resumen/rango/logros/calendario). */
export function SectionTabs() {
  const pathname = usePathname();
  const section = SECTION_TABS.find((s) => isActive(pathname, s.match));
  // En pantallas de detalle (p. ej. /workouts/new) no se muestran.
  if (!section || !section.tabs.some((t) => t.href === pathname)) return null;
  return (
    <nav
      aria-label="Sección"
      className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex w-max gap-1 rounded-full bg-surface-2 p-1">
        {section.tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-muted transition-colors",
                  active
                    ? "bg-surface text-foreground shadow-sm"
                    : "hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Muestra su contenido sólo en ciertas pantallas (p. ej. el selector de grupo en Hoy y Grupo). */
export function ShowOn({
  paths,
  children,
}: {
  paths: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return paths.includes(pathname) ? <>{children}</> : null;
}
