"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { startChallenge } from "@/app/actions/challenges";
import { CHALLENGE_DAYS, CHALLENGE_TEMPLATES, type ChallengeDays } from "@/lib/challenges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Elegir un reto sugerido (o escribir uno) y su duración. */
export function NewChallenge({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [days, setDays] = useState<ChallengeDays>(21);

  const submit = () =>
    start(async () => {
      const res = await startChallenge({ title, emoji, days });
      if (!res.ok) return void toast.error(res.error);
      toast.success("¡Reto empezado! Márcalo cada día que lo cumplas.");
      setTitle("");
      setEmoji("🎯");
      router.refresh();
    });

  return (
    <div className="grid gap-4">
      <ul className="flex flex-wrap gap-2" aria-label="Retos sugeridos">
        {CHALLENGE_TEMPLATES.map((t) => (
          <li key={t.title}>
            <button
              type="button"
              onClick={() => {
                setTitle(t.title);
                setEmoji(t.emoji);
              }}
              className={cn(
                "rounded-full border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-surface-2",
                title === t.title && "border-primary bg-primary-soft text-primary",
              )}
            >
              {t.emoji} {t.title}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setEmoji("🎯");
          }}
          maxLength={60}
          placeholder="O escribe tu propio reto…"
          aria-label="Tu reto"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Duración:</span>
          {CHALLENGE_DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={cn(
                "rounded-full border border-border px-3 py-1.5 text-sm font-semibold",
                days === d ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-surface-2",
              )}
            >
              {d} días
            </button>
          ))}
          <Button type="submit" className="ml-auto" disabled={pending || disabled || title.trim().length < 2}>
            <Plus aria-hidden="true" /> Empezar reto
          </Button>
        </div>
        {disabled ? <p className="text-xs text-muted">Ya tienes 5 retos activos: termina o deja alguno para empezar otro.</p> : null}
      </form>
    </div>
  );
}
