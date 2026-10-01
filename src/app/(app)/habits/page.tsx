import type { Metadata } from "next";
import { Lock, Users } from "lucide-react";
import { requireGroup } from "@/lib/data/session";
import { getAllHabits } from "@/lib/data/queries";
import { HabitsManager } from "@/components/admin/habits-manager";
import { HabitTemplates } from "@/components/habits/habit-templates";
import { HabitIcon } from "@/components/habits/habit-icon";

export const metadata: Metadata = { title: "Mis hábitos" };

export default async function MyHabitsPage() {
  const { supabase, userId, activeGroup, today } = await requireGroup();
  const [mine, shared] = await Promise.all([getAllHabits(supabase, activeGroup.id, userId), getAllHabits(supabase, activeGroup.id, null)]);
  const activeShared = shared.filter((h) => h.is_active);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Mis hábitos</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <Lock className="size-3.5" aria-hidden="true" /> Son tuyos: los eliges y los cambias cuando quieras.
        </p>
      </header>

      <section className="grid gap-3" aria-labelledby="populares">
        <h2 id="populares" className="text-sm font-bold">
          {mine.length ? "Añadir más en un toque" : "Empieza eligiendo 3-5 hábitos"}
        </h2>
        <HabitTemplates groupId={activeGroup.id} today={today} existing={mine.map((h) => h.name)} />
      </section>

      <section className="grid gap-3" aria-labelledby="tuyos">
        <h2 id="tuyos" className="text-sm font-bold">
          Tus hábitos {mine.length ? `(${mine.length})` : ""}
        </h2>
        {mine.length === 0 ? <p className="text-sm text-muted">Aún no tienes ninguno. Toca uno de arriba o crea el tuyo.</p> : null}
        <HabitsManager groupId={activeGroup.id} habits={mine} today={today} personal />
      </section>

      {activeShared.length ? (
        <section className="grid gap-3 rounded-3xl border border-border bg-surface p-4" aria-labelledby="comunes">
          <h2 id="comunes" className="flex items-center gap-2 text-sm font-bold">
            <Users className="size-4" aria-hidden="true" /> Comunes de «{activeGroup.name}»
          </h2>
          <p className="text-xs text-muted">Los decide el administrador del grupo y cuentan para todos.</p>
          <ul className="flex flex-wrap gap-2">
            {activeShared.map((h) => (
              <li key={h.id} className="inline-flex items-center gap-2 rounded-full bg-surface-2 py-1.5 pr-3 pl-1.5 text-sm">
                <span className="grid size-6 place-items-center rounded-full" style={{ backgroundColor: `${h.color}22`, color: h.color }}>
                  <HabitIcon name={h.icon} className="size-3.5" />
                </span>
                {h.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
