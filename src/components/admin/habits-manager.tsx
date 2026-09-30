"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  LoaderCircle,
  Pencil,
  Plus,
} from "lucide-react";
import {
  archiveHabit,
  moveHabit,
  saveHabit,
  setHabitActive,
} from "@/app/actions/groups";
import type {
  HabitCategory,
  HabitFrequency,
  HabitRow,
} from "@/lib/database.types";
import {
  CATEGORY_LABELS,
  describeFrequency,
  FREQUENCY_LABELS,
} from "@/lib/labels";
import {
  HABIT_CATEGORIES,
  HABIT_FREQUENCIES,
  HABIT_WEIGHTS,
} from "@/lib/validation";
import { WEEKDAY_LABELS, WEEKDAY_NAMES } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { HABIT_ICONS, HabitIcon } from "@/components/habits/habit-icon";
import { cn } from "@/lib/utils";

const WEIGHT_LABELS: Record<(typeof HABIT_WEIGHTS)[number], string> = {
  1: "Normal ×1",
  1.5: "Exigente ×1,5",
  2: "Clave ×2",
};

const COLORS = [
  "#38bdf8",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#64748b",
];

type Draft = {
  id?: string;
  name: string;
  description: string;
  icon: string;
  category: HabitCategory;
  color: string;
  frequency: HabitFrequency;
  weekdays: number[];
  weeklyTarget: string;
  isOptional: boolean;
  weight: number;
  goal: string;
  startsOn: string;
};

function toDraft(h: HabitRow | null, today: string): Draft {
  return {
    id: h?.id,
    name: h?.name ?? "",
    description: h?.description ?? "",
    icon: h?.icon ?? "check",
    category: h?.category ?? "physical",
    color: h?.color ?? "#38bdf8",
    frequency: h?.frequency ?? "daily",
    weekdays: h?.weekdays ?? [],
    weeklyTarget: h?.weekly_target ? String(h.weekly_target) : "3",
    isOptional: h?.is_optional ?? false,
    weight: h ? Number(h.weight) : 1,
    goal: h?.goal ?? "",
    startsOn: h?.starts_on ?? today,
  };
}

export function HabitsManager({
  groupId,
  habits,
  today,
}: {
  groupId: string;
  habits: HabitRow[];
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Draft | null>(null);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success?: string,
  ) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        if (success) toast.success(success);
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {habits.map((h, i) => (
          <li
            key={h.id}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3",
              !h.is_active && "opacity-60",
            )}
          >
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl"
              style={{ backgroundColor: `${h.color}22`, color: h.color }}
            >
              <HabitIcon name={h.icon} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{h.name}</p>
              <p className="text-xs text-muted">
                {CATEGORY_LABELS[h.category]} · {describeFrequency(h)}
                {Number(h.weight) > 1
                  ? ` · peso ×${String(Number(h.weight)).replace(".", ",")}`
                  : ""}
                {h.goal ? ` · ${h.goal}` : ""}
              </p>
            </div>
            {!h.is_active ? <Badge>Inactivo</Badge> : null}
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Subir ${h.name}`}
                disabled={pending || i === 0}
                onClick={() =>
                  run(() =>
                    moveHabit({ groupId, habitId: h.id, direction: "up" }),
                  )
                }
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Bajar ${h.name}`}
                disabled={pending || i === habits.length - 1}
                onClick={() =>
                  run(() =>
                    moveHabit({ groupId, habitId: h.id, direction: "down" }),
                  )
                }
              >
                <ArrowDown aria-hidden="true" />
              </Button>
              <Switch
                checked={h.is_active}
                disabled={pending}
                aria-label={
                  h.is_active ? `Desactivar ${h.name}` : `Activar ${h.name}`
                }
                onCheckedChange={(v) =>
                  run(
                    () => setHabitActive({ habitId: h.id, value: v }),
                    v ? "Hábito activado" : "Hábito desactivado",
                  )
                }
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Editar ${h.name}`}
                onClick={() => setEditing(toDraft(h, today))}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-danger"
                aria-label={`Archivar ${h.name}`}
                disabled={pending}
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Archivar «${h.name}»? Dejará de aparecer y de contar en las estadísticas.`,
                    )
                  )
                    run(() => archiveHabit(h.id), "Hábito archivado");
                }}
              >
                <Archive aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        className="justify-self-start"
        onClick={() => setEditing(toDraft(null, today))}
      >
        <Plus aria-hidden="true" /> Añadir hábito
      </Button>
      <p className="text-xs text-muted">
        Desactivar un hábito lo quita del día a día y de las estadísticas
        (también del histórico). «Activo desde» evita que un hábito nuevo
        penalice los días anteriores. En los rangos, los cambios de peso,
        frecuencia u obligatoriedad se aplican desde mañana y los hábitos
        desactivados o archivados siguen contando en los días pasados: el
        histórico no se reescribe.
      </p>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        {editing ? (
          <DialogContent title={editing.id ? "Editar hábito" : "Nuevo hábito"}>
            <HabitForm
              draft={editing}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                router.refresh();
              }}
              groupId={groupId}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function HabitForm({
  draft,
  groupId,
  onSaved,
  onCancel,
}: {
  draft: Draft;
  groupId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(draft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveHabit({
            ...form,
            groupId,
            weeklyTarget:
              form.frequency === "weekly_target"
                ? Number(form.weeklyTarget)
                : null,
          });
          if (res.ok) {
            toast.success("Hábito guardado ✓");
            onSaved();
          } else {
            setErrors(res.fieldErrors ?? {});
            toast.error(res.error);
          }
        });
      }}
    >
      <Field label="Nombre" htmlFor="h-name" error={errors.name}>
        <Input
          id="h-name"
          value={form.name}
          maxLength={60}
          onChange={(e) => set("name", e.target.value)}
          required
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría" htmlFor="h-category">
          <Select
            id="h-category"
            value={form.category}
            onChange={(e) => set("category", e.target.value as HabitCategory)}
          >
            {HABIT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Objetivo" htmlFor="h-goal" error={errors.goal}>
          <Input
            id="h-goal"
            value={form.goal}
            maxLength={100}
            placeholder="Ej.: 30 min"
            onChange={(e) => set("goal", e.target.value)}
          />
        </Field>
      </div>
      <Field
        label="Descripción"
        htmlFor="h-description"
        error={errors.description}
      >
        <Input
          id="h-description"
          value={form.description}
          maxLength={300}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Frecuencia</legend>
        <div className="grid grid-cols-3 gap-2">
          {HABIT_FREQUENCIES.map((f) => (
            <label
              key={f}
              className={cn(
                "cursor-pointer rounded-xl border border-border p-2.5 text-center text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                form.frequency === f &&
                  "border-primary bg-primary-soft text-primary",
              )}
            >
              <input
                type="radio"
                name="frequency"
                className="sr-only"
                checked={form.frequency === f}
                onChange={() => set("frequency", f)}
              />
              {FREQUENCY_LABELS[f]}
            </label>
          ))}
        </div>
        {form.frequency === "weekdays" ? (
          <div
            className="grid grid-cols-7 gap-1.5"
            role="group"
            aria-label="Días de la semana"
          >
            {WEEKDAY_LABELS.map((label, i) => {
              const day = i + 1;
              const on = form.weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAY_NAMES[i]}
                  onClick={() =>
                    set(
                      "weekdays",
                      on
                        ? form.weekdays.filter((d) => d !== day)
                        : [...form.weekdays, day].sort(),
                    )
                  }
                  className={cn(
                    "h-10 rounded-lg border border-border text-sm font-semibold",
                    on && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}
        {form.frequency === "weekly_target" ? (
          <Field
            label="Veces por semana"
            htmlFor="h-target"
            error={errors.weeklyTarget}
          >
            <Select
              id="h-target"
              value={form.weeklyTarget}
              onChange={(e) => set("weeklyTarget", e.target.value)}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {errors.weekdays ? (
          <p className="text-sm text-danger">{errors.weekdays}</p>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">
          Dificultad (peso en el rango)
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {HABIT_WEIGHTS.map((w) => (
            <label
              key={w}
              className={cn(
                "cursor-pointer rounded-xl border border-border p-2.5 text-center text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                form.weight === w &&
                  "border-primary bg-primary-soft text-primary",
              )}
            >
              <input
                type="radio"
                name="weight"
                className="sr-only"
                checked={form.weight === w}
                onChange={() => set("weight", w)}
              />
              {WEIGHT_LABELS[w]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          Reserva «Clave» para lo realmente importante. Los cambios de peso
          cuentan desde mañana.
        </p>
        {errors.weight ? (
          <p className="text-sm text-danger">{errors.weight}</p>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Icono</legend>
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
          {Object.keys(HABIT_ICONS).map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={form.icon === name}
              aria-label={`Icono ${name}`}
              onClick={() => set("icon", name)}
              className={cn(
                "grid aspect-square place-items-center rounded-lg border border-border",
                form.icon === name &&
                  "border-primary bg-primary-soft text-primary",
              )}
            >
              <HabitIcon name={name} className="size-4" />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={form.color === c}
              aria-label={`Color ${c}`}
              onClick={() => set("color", c)}
              className={cn(
                "size-9 rounded-full ring-offset-2 ring-offset-surface",
                form.color === c && "ring-2 ring-foreground",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 items-end gap-3">
        <Field label="Activo desde" htmlFor="h-starts" error={errors.startsOn}>
          <Input
            id="h-starts"
            type="date"
            value={form.startsOn}
            onChange={(e) => set("startsOn", e.target.value)}
          />
        </Field>
        <label
          htmlFor="h-optional"
          className="flex h-11 items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 text-sm font-medium"
        >
          Opcional
          <Switch
            id="h-optional"
            checked={form.isOptional}
            onCheckedChange={(v) => set("isOptional", v)}
          />
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : null}
          Guardar
        </Button>
      </div>
    </form>
  );
}
