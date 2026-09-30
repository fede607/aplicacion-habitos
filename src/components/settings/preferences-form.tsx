"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { updatePreferences } from "@/app/actions/settings";
import type { UserSettingsRow } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-start justify-between gap-4 rounded-xl bg-surface-2 p-3"
    >
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function PreferencesForm({ settings }: { settings: UserSettingsRow }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    shareHabits: settings.share_habits,
    shareWorkouts: settings.share_workouts,
    showInComparison: settings.show_in_comparison,
    reminderEnabled: settings.reminder_enabled,
    reminderTime: settings.reminder_time.slice(0, 5),
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await updatePreferences(form);
          if (res.ok) toast.success("Preferencias guardadas ✓");
          else toast.error(res.error);
        });
      }}
    >
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">Privacidad</legend>
        <ToggleRow
          id="pref-habits"
          title="Compartir mis hábitos con el grupo"
          description="Cumplimiento, racha y días activos. Si lo desactivas, el grupo verá «Estadísticas privadas»."
          checked={form.shareHabits}
          onChange={(v) => set("shareHabits", v)}
        />
        <ToggleRow
          id="pref-workouts"
          title="Compartir resumen de entrenamientos"
          description="Sólo número de sesiones y tiempo total. Nunca tus notas."
          checked={form.shareWorkouts}
          onChange={(v) => set("shareWorkouts", v)}
        />
        <ToggleRow
          id="pref-compare"
          title="Aparecer en la vista de comparación"
          description="Sólo si el grupo la tiene activada."
          checked={form.showInComparison}
          onChange={(v) => set("showInComparison", v)}
        />
        <p className="px-1 text-xs text-muted">
          🔒 Tus notas diarias y los detalles de tus entrenamientos son siempre
          privados.
        </p>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">Recordatorio</legend>
        <ToggleRow
          id="pref-reminder"
          title="Recordatorio en la app"
          description="Te avisamos en la app si a esa hora te quedan hábitos por marcar."
          checked={form.reminderEnabled}
          onChange={(v) => set("reminderEnabled", v)}
        />
        <Field
          label="Hora del recordatorio"
          htmlFor="pref-time"
          className="max-w-48"
          hint="También la usa el recordatorio por email."
        >
          <Input
            id="pref-time"
            type="time"
            value={form.reminderTime}
            onChange={(e) => set("reminderTime", e.target.value)}
          />
        </Field>
      </fieldset>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : null}
        Guardar preferencias
      </Button>
    </form>
  );
}
