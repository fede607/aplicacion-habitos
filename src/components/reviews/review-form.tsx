"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LoaderCircle, Star } from "lucide-react";
import { saveReview } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ReviewValues = { rating: number; body: string; allowPublic: boolean };

const LABELS = ["", "Nada útil", "Mejorable", "Está bien", "Me gusta", "¡Me encanta!"];

export function ReviewForm({ initial, onDone }: { initial?: ReviewValues | null; onDone?: () => void }) {
  const [pending, start] = useTransition();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [body, setBody] = useState(initial?.body ?? "");
  const [allowPublic, setAllowPublic] = useState(initial?.allowPublic ?? true);

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return toast.error("Elige de 1 a 5 estrellas.");
        start(async () => {
          const res = await saveReview({ rating, body, allowPublic });
          if (!res.ok) return void toast.error(res.error);
          toast.success(rating >= 4 ? "¡Gracias! Nos ayudas muchísimo 🙌" : "Gracias por decírnoslo: lo vamos a mejorar.");
          onDone?.();
        });
      }}
    >
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Valoración">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={`${i} estrellas`}
            onClick={() => setRating(i)}
            className="grid size-11 place-items-center rounded-xl transition-transform active:scale-90"
          >
            <Star className={cn("size-8", i <= rating ? "fill-amber-400 text-amber-400" : "text-border")} aria-hidden="true" />
          </button>
        ))}
        <span className="ml-2 text-sm font-semibold text-muted">{LABELS[rating]}</span>
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 280))}
        rows={3}
        placeholder={rating && rating <= 3 ? "¿Qué mejorarías?" : "¿Qué es lo que más te ayuda de Year Arc?"}
        aria-label="Tu opinión"
      />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={allowPublic} onChange={(e) => setAllowPublic(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
        <span>
          Se puede publicar en la web con mi nombre (sólo el nombre de pila) y mi avatar.
          <span className="block text-xs text-muted">{body.length}/280 · Puedes cambiarlo cuando quieras en Perfil.</span>
        </span>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null} Enviar opinión
      </Button>
    </form>
  );
}
