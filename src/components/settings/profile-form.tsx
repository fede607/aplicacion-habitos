"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { updateProfile } from "@/app/actions/settings";
import type { ProfileRow } from "@/lib/database.types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const noop = () => () => {};
const EMOJIS = ["", "❄️", "🔥", "🥊", "💪", "📚", "🧠", "🏔️", "⚡", "🐺", "🦅", "🧊"];
const COLORS = ["#38bdf8", "#6366f1", "#a855f7", "#ec4899", "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#64748b"];

export function ProfileForm({ profile }: { profile: ProfileRow }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    displayName: profile.display_name,
    username: profile.username,
    avatarEmoji: profile.avatar_emoji ?? "",
    avatarColor: profile.avatar_color,
    timezone: profile.timezone,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  // La lista del navegador difiere de la de Node: se carga tras hidratar para evitar desajustes.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const timezones = useMemo(() => {
    const list = mounted && typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return list.includes(form.timezone) ? list : [form.timezone, ...list];
  }, [form.timezone, mounted]);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await updateProfile(form);
          if (res.ok) {
            setErrors({});
            toast.success("Perfil guardado ✓");
          } else {
            setErrors(res.fieldErrors ?? {});
            toast.error(res.error);
          }
        });
      }}
    >
      <div className="flex items-center gap-4">
        <Avatar name={form.displayName || "?"} emoji={form.avatarEmoji || null} color={form.avatarColor} size="lg" />
        <div className="grid flex-1 gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Emoji del avatar">
            {EMOJIS.map((e) => (
              <button
                key={e || "none"}
                type="button"
                aria-pressed={form.avatarEmoji === e}
                aria-label={e ? `Emoji ${e}` : "Sin emoji (iniciales)"}
                onClick={() => set("avatarEmoji", e)}
                className={cn("grid size-9 place-items-center rounded-lg border border-border text-lg", form.avatarEmoji === e && "border-primary bg-primary-soft")}
              >
                {e || <span className="text-xs font-semibold">Aa</span>}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Color del avatar">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={form.avatarColor === c}
                aria-label={`Color ${c}`}
                onClick={() => set("avatarColor", c)}
                className={cn("size-7 rounded-full ring-offset-2 ring-offset-surface", form.avatarColor === c && "ring-2 ring-foreground")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="p-name" error={errors.displayName}>
          <Input id="p-name" value={form.displayName} maxLength={40} onChange={(e) => set("displayName", e.target.value)} required />
        </Field>
        <Field label="Nombre de usuario" htmlFor="p-username" error={errors.username}>
          <Input id="p-username" value={form.username} maxLength={24} autoCapitalize="none" spellCheck={false} onChange={(e) => set("username", e.target.value.toLowerCase())} required />
        </Field>
      </div>
      <Field label="Zona horaria" htmlFor="p-tz" error={errors.timezone} hint="Define qué día es «hoy» para tus registros.">
        <Select id="p-tz" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
        Guardar perfil
      </Button>
    </form>
  );
}
