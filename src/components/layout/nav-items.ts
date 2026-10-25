import { ChartNoAxesColumn, Dumbbell, House, Sparkles, Target, UserRound, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  mobile: boolean;
  free?: boolean;
  match: string[];
};

/**
 * Navegación de 5 pestañas (como Strava o Nike Training Club): cada una agrupa
 * sus pantallas y dentro se cambia con las pestañas de sección.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/today",
    label: "Hoy",
    icon: House,
    mobile: true,
    free: true,
    match: ["/today"],
  },
  {
    href: "/plan",
    label: "Entreno",
    icon: Dumbbell,
    mobile: true,
    match: ["/plan", "/workouts"],
  },
  {
    href: "/group",
    label: "Grupo",
    icon: Users,
    mobile: true,
    free: true,
    match: ["/group"],
  },
  {
    href: "/dashboard",
    label: "Progreso",
    icon: ChartNoAxesColumn,
    mobile: true,
    match: ["/dashboard", "/progress", "/rank", "/calendar", "/retos"],
  },
  {
    href: "/settings",
    label: "Perfil",
    icon: UserRound,
    mobile: true,
    free: true,
    match: ["/settings", "/pro"],
  },
  {
    href: "/pro",
    label: "Pro",
    icon: Sparkles,
    mobile: false,
    free: true,
    match: [],
  },
];

/** Sub-pestañas de cada sección. */
export const SECTION_TABS: {
  match: string[];
  tabs: { href: string; label: string }[];
}[] = [
  {
    match: ["/plan", "/workouts"],
    tabs: [
      { href: "/plan", label: "Mi plan" },
      { href: "/workouts", label: "Registro" },
    ],
  },
  {
    match: ["/dashboard", "/progress", "/rank", "/calendar", "/retos"],
    tabs: [
      { href: "/dashboard", label: "Resumen" },
      { href: "/retos", label: "Retos" },
      { href: "/rank", label: "Rango" },
      { href: "/progress", label: "Logros" },
      { href: "/calendar", label: "Calendario" },
    ],
  },
];

/**
 * Versión individual (espacio personal): la pestaña Grupo se cambia por Retos
 * y Retos deja de colgar de Progreso.
 */
export function navItemsFor(personal: boolean): NavItem[] {
  if (!personal) return NAV_ITEMS;
  return NAV_ITEMS.map((item) => {
    if (item.href === "/group") return { href: "/retos", label: "Retos", icon: Target, mobile: true, free: true, match: ["/retos"] };
    if (item.href === "/dashboard") return { ...item, match: item.match.filter((m) => m !== "/retos") };
    return item;
  });
}

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
