import { CalendarDays, Dumbbell, LayoutDashboard, ListChecks, Medal, Settings, TrendingUp, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; mobile: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Hoy", icon: ListChecks, mobile: true },
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard, mobile: true },
  { href: "/calendar", label: "Calendario", icon: CalendarDays, mobile: true },
  { href: "/workouts", label: "Entrenos", icon: Dumbbell, mobile: true },
  { href: "/rank", label: "Rango", icon: Medal, mobile: false },
  { href: "/progress", label: "Progreso", icon: TrendingUp, mobile: false },
  { href: "/group", label: "Grupo", icon: Users, mobile: true },
  { href: "/settings", label: "Ajustes", icon: Settings, mobile: false },
];
