"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";

const target = (href: string, free: boolean | undefined, locked: boolean) => (locked && !free ? "/pro?locked=1" : href);

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ locked = false }: { locked?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="grid gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, free }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={target(href, free, locked)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground",
              active && "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
            {locked && !free ? <Lock className="ml-auto size-3.5 text-muted" aria-label="Pro" /> : null}
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
        {NAV_ITEMS.filter((i) => i.mobile).map(({ href, label, icon: Icon, free }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={target(href, free, locked)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted transition-colors",
                  active && "text-primary",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-6 transition-transform", active && "scale-110", locked && !free && "opacity-50")} aria-hidden="true" />
                  {locked && !free ? <Lock className="absolute -right-1.5 -bottom-1 size-3 text-muted" aria-label="Pro" /> : null}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
