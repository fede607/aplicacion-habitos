"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { saveHabit } from "@/app/actions/groups";
import type { HabitCategory, HabitFrequency } from "@/lib/database.types";
import { HabitIcon } from "./habit-icon";

type Template = {
  name: string;
  icon: string;
  color: string;
  category: HabitCategory;
  goal: string;
  frequency?: HabitFrequency;
  weeklyTarget?: number;
};

/** Hábitos más populares: se añaden en un toque y luego se pueden editar. */
export const HABIT_TEMPLATES: Template[] = [
  { name: "Entrenar", icon: "dumbbell", color: "#f97316", category: "physical", goal: "45 min", frequency: "weekly_target", weeklyTarget: 4 },
  { name: "Leer", icon: "book-open", color: "#a855f7", category: "mental", goal: "20 páginas" },
  { name: "Beber agua", icon: "droplet", color: "#0ea5e9", category: "health", goal: "2 L" },
  { name: "Dormir 8 horas", icon: "bed", color: "#6366f1", category: "health", goal: "Antes de las 23:30" },
  { name: "Meditar", icon: "brain", color: "#14b8a6", category: "mental", goal: "10 min" },
  { name: "Caminar 10.000 pasos", icon: "footprints", color: "#22c55e", category: "physical", goal: "10.000 pasos" },
  { name: "Estudiar", icon: "graduation-cap", color: "#eab308", category: "productivity", goal: "1 h de foco" },
  { name: "Madrugar", icon: "sun", color: "#f59e0b", category: "health", goal: "Antes de las 7:00" },
  { name: "Comer sano", icon: "apple", color: "#16a34a", category: "health", goal: "Sin ultraprocesados" },
  { name: "Menos redes", icon: "timer", color: "#64748b", category: "mental", goal: "Máx. 30 min" },
  { name: "Ducha fría", icon: "snowflake", color: "#38bdf8", category: "mental", goal: "2 min" },
  { name: "Escribir el diario", icon: "notebook-pen", color: "#ec4899", category: "mental", goal: "5 min" },
  { name: "Estirar", icon: "person-standing", color: "#06b6d4", category: "physical", goal: "10 min" },
  { name: "Aprender un idioma", icon: "languages", color: "#8b5cf6", category: "productivity", goal: "15 min" },
];

export function HabitTemplates({ groupId, today, existing }: { groupId: string; today: string; existing: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const have = new Set(existing.map((n) => n.trim().toLowerCase()));
  const available = HABIT_TEMPLATES.filter((t) => !have.has(t.name.toLowerCase()));
  if (!available.length) return null;

  const add = (t: Template) =>
    start(async () => {
      const res = await saveHabit({
        groupId,
        personal: true,
        name: t.name,
        description: "",
        icon: t.icon,
        category: t.category,
        color: t.color,
        frequency: t.frequency ?? "daily",
        weekdays: [],
        weeklyTarget: t.frequency === "weekly_target" ? (t.weeklyTarget ?? 3) : null,
        isOptional: false,
        weight: 1,
        goal: t.goal,
        startsOn: today,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`«${t.name}» añadido`);
      router.refresh();
    });

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Hábitos populares">
      {available.map((t) => (
        <li key={t.name}>
          <button
            type="button"
            disabled={pending}
            onClick={() => add(t)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-2 pr-3.5 pl-2 text-sm font-medium transition-all hover:bg-surface-2 active:scale-95 disabled:opacity-50"
          >
            <span className="grid size-7 place-items-center rounded-full" style={{ backgroundColor: `${t.color}22`, color: t.color }}>
              <HabitIcon name={t.icon} className="size-4" />
            </span>
            {t.name}
            <Plus className="size-4 text-muted" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
