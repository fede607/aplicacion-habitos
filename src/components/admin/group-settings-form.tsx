"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { updateGroupSettings } from "@/app/actions/groups";
import type { GroupRow } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function GroupSettingsForm({ group }: { group: GroupRow }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: group.name,
    description: group.description,
    rules: group.rules,
    startDate: group.start_date,
    endDate: group.end_date,
    streakThreshold: String(group.streak_threshold),
    comparisonEnabled: group.comparison_enabled,
    maxMembers: String(group.max_members),
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await updateGroupSettings({ ...form, groupId: group.id });
          if (res.ok) {
            setErrors({});
            toast.success("Configuración guardada ✓");
          } else {
            setErrors(res.fieldErrors ?? {});
            toast.error(res.error);
          }
        });
      }}
    >
      <Field label="Nombre" htmlFor="gs-name" error={errors.name}>
        <Input id="gs-name" value={form.name} maxLength={60} onChange={(e) => set("name", e.target.value)} required />
      </Field>
      <Field label="Descripción" htmlFor="gs-description" error={errors.description}>
        <Textarea id="gs-description" value={form.description} maxLength={500} className="min-h-20" onChange={(e) => set("description", e.target.value)} />
      </Field>
      <Field label="Reglas del grupo" htmlFor="gs-rules" error={errors.rules} hint="Visibles para todos los miembros.">
        <Textarea id="gs-rules" value={form.rules} maxLength={2000} onChange={(e) => set("rules", e.target.value)} placeholder="Ej.: Registrar antes de las 23:59. Sin excusas, sólo soluciones." />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Inicio" htmlFor="gs-start" error={errors.startDate}>
          <Input id="gs-start" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} required />
        </Field>
        <Field label="Fin" htmlFor="gs-end" error={errors.endDate}>
          <Input id="gs-end" type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Día cumplido a partir de (%)" htmlFor="gs-threshold" error={errors.streakThreshold} hint="Cuenta para rachas y calendario.">
          <Input id="gs-threshold" type="number" inputMode="numeric" min={1} max={100} value={form.streakThreshold} onChange={(e) => set("streakThreshold", e.target.value)} />
        </Field>
        <Field label="Máximo de miembros" htmlFor="gs-max" error={errors.maxMembers}>
          <Input id="gs-max" type="number" inputMode="numeric" min={2} max={1000} value={form.maxMembers} onChange={(e) => set("maxMembers", e.target.value)} />
        </Field>
      </div>
      <label htmlFor="gs-compare" className="flex items-start justify-between gap-4 rounded-xl bg-surface-2 p-3">
        <span>
          <span className="block text-sm font-medium">Permitir vista de comparación</span>
          <span className="block text-xs text-muted">Opcional. Sólo aparece quien lo acepte en sus ajustes de privacidad.</span>
        </span>
        <Switch id="gs-compare" checked={form.comparisonEnabled} onCheckedChange={(v) => set("comparisonEnabled", v)} />
      </label>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
        Guardar configuración
      </Button>
    </form>
  );
}
