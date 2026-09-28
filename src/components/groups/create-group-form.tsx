"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { createGroup } from "@/app/actions/groups";
import { addDays } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function CreateGroupForm({ today }: { today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: `WINTER ARC ${today.slice(0, 4)}`,
    description: "",
    startDate: today,
    endDate: addDays(today, 90),
    seedDefaults: true,
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await createGroup(form);
          if (res.ok) {
            toast.success("¡Grupo creado! Invita a tus amigos.");
            router.push("/group/admin?created=1");
          } else {
            setErrors(res.fieldErrors ?? {});
            toast.error(res.error);
          }
        });
      }}
    >
      <Field label="Nombre del Winter Arc" htmlFor="group-name" error={errors.name}>
        <Input
          id="group-name"
          value={form.name}
          maxLength={60}
          required
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          aria-invalid={!!errors.name}
        />
      </Field>
      <Field label="Descripción (opcional)" htmlFor="group-description" error={errors.description}>
        <Textarea
          id="group-description"
          value={form.description}
          maxLength={500}
          className="min-h-20"
          placeholder="90 días de disciplina: entrenar, estudiar y leer."
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Inicio" htmlFor="group-start" error={errors.startDate}>
          <Input
            id="group-start"
            type="date"
            value={form.startDate}
            required
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </Field>
        <Field label="Fin" htmlFor="group-end" error={errors.endDate}>
          <Input
            id="group-end"
            type="date"
            value={form.endDate}
            required
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
        </Field>
      </div>
      <label className="flex items-start justify-between gap-4 rounded-xl bg-surface-2 p-3" htmlFor="group-seed">
        <span>
          <span className="block text-sm font-medium">Usar los hábitos del Winter Arc</span>
          <span className="block text-xs text-muted">
            Entrenamiento, boxeo, movilidad, activación, reflexión, lectura, actitud, estudio y proyecto AdSense. Podrás
            editarlos.
          </span>
        </span>
        <Switch
          id="group-seed"
          checked={form.seedDefaults}
          onCheckedChange={(v) => setForm({ ...form, seedDefaults: v })}
        />
      </label>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
        Crear grupo
      </Button>
    </form>
  );
}
