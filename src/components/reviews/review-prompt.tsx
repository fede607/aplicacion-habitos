"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ReviewForm } from "./review-form";

const KEY = "ya-review-snooze";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

/** Pide opinión una vez que la persona lleva una semana usando la app. «Ahora no» lo pospone 14 días. */
export function ReviewPrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let snoozedUntil = 0;
    try {
      snoozedUntil = Number(localStorage.getItem(KEY) ?? 0);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sólo se sabe en el navegador
    setShow(Date.now() > snoozedUntil);
  }, []);
  if (!show) return null;
  const snooze = () => {
    try {
      localStorage.setItem(KEY, String(Date.now() + SNOOZE_MS));
    } catch {}
    setShow(false);
  };
  return (
    <section aria-labelledby="review-title" className="relative grid gap-3 rounded-3xl border border-amber-400/40 bg-surface p-5 shadow-card">
      <button type="button" onClick={snooze} aria-label="Ahora no" className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2">
        <X className="size-4" aria-hidden="true" />
      </button>
      <div className="pr-8">
        <h2 id="review-title" className="font-bold">
          ¿Qué te está pareciendo Year Arc?
        </h2>
        <p className="text-sm text-muted">Llevas ya una semana. Tu opinión nos ayuda a mejorar y a que más gente se anime.</p>
      </div>
      <ReviewForm onDone={() => setShow(false)} />
      <button type="button" onClick={snooze} className="justify-self-center text-xs text-muted underline">
        Ahora no
      </button>
    </section>
  );
}
