"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { saveDailyEntry } from "@/app/actions/tracking";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";

type State = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";
type Conflict = { didToday: string; improveTomorrow: string; updatedAt: string };

const MAX = 2000;
const DEBOUNCE_MS = 1200;

/**
 * Notas del día con autoguardado. Usa control de concurrencia optimista
 * (updated_at) para no pisar cambios hechos en otra pestaña o dispositivo.
 */
export function DailyNotes({
  date,
  initial,
  editable,
}: {
  date: string;
  initial: { didToday: string; improveTomorrow: string; updatedAt: string | null };
  editable: boolean;
}) {
  const [didToday, setDidToday] = useState(initial.didToday);
  const [improve, setImprove] = useState(initial.improveTomorrow);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const updatedAt = useRef<string | null>(initial.updatedAt);
  const latest = useRef({ didToday: initial.didToday, improve: initial.improveTomorrow });
  const saved = useRef({ didToday: initial.didToday, improve: initial.improveTomorrow });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const saveRef = useRef<() => void>(() => {});

  const save = useCallback(
    async (force = false) => {
      if (saving.current) return;
      const snapshot = { ...latest.current };
      if (!force && snapshot.didToday === saved.current.didToday && snapshot.improve === saved.current.improve) {
        setState((s) => (s === "dirty" ? "saved" : s));
        return;
      }
      saving.current = true;
      setState("saving");
      try {
        const res = await saveDailyEntry({
          date,
          didToday: snapshot.didToday,
          improveTomorrow: snapshot.improve,
          expectedUpdatedAt: updatedAt.current,
        });
        if (res.ok) {
          updatedAt.current = res.data.updatedAt;
          saved.current = snapshot;
          setError(null);
          const stillDirty =
            latest.current.didToday !== snapshot.didToday || latest.current.improve !== snapshot.improve;
          setState(stillDirty ? "dirty" : "saved");
          if (stillDirty) timer.current = setTimeout(() => saveRef.current(), DEBOUNCE_MS);
        } else if (res.code === "conflict") {
          if ("conflict" in res && res.conflict) setConflict(res.conflict);
          setState("conflict");
        } else {
          setError(res.error);
          setState("error");
        }
      } catch {
        setError("Sin conexión. Reintentaremos automáticamente.");
        setState("error");
        timer.current = setTimeout(() => saveRef.current(), 5000);
      } finally {
        saving.current = false;
      }
    },
    [date],
  );

  useEffect(() => {
    saveRef.current = () => void save();
  }, [save]);

  const schedule = useCallback(() => {
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), DEBOUNCE_MS);
  }, [save]);

  useEffect(() => {
    const onOnline = () => void save();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [save]);

  useEffect(() => {
    if (state !== "dirty" && state !== "saving" && state !== "error") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state]);

  const resolveWithServer = () => {
    if (!conflict) return;
    setDidToday(conflict.didToday);
    setImprove(conflict.improveTomorrow);
    latest.current = { didToday: conflict.didToday, improve: conflict.improveTomorrow };
    saved.current = { ...latest.current };
    updatedAt.current = conflict.updatedAt;
    setConflict(null);
    setState("saved");
  };

  const resolveWithMine = () => {
    if (!conflict) return;
    updatedAt.current = conflict.updatedAt;
    setConflict(null);
    void save(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notas del día</CardTitle>
        <NotesStatus state={state} />
      </CardHeader>
      <CardContent className="grid gap-4">
        {conflict ? (
          <div role="alert" className="grid gap-3 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm">
            <p className="flex items-start gap-2 font-medium text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Estas notas se han modificado en otro dispositivo o pestaña.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={resolveWithServer}>
                Cargar la otra versión
              </Button>
              <Button size="sm" onClick={resolveWithMine}>
                Guardar la mía
              </Button>
            </div>
          </div>
        ) : null}
        <NoteField
          id={`did-${date}`}
          label="¿Qué hice hoy?"
          placeholder="Ej.: Entrené 1 hora, leí 20 páginas y estudié 2 horas."
          value={didToday}
          disabled={!editable}
          onChange={(v) => {
            setDidToday(v);
            latest.current.didToday = v;
            schedule();
          }}
          onBlur={() => void save()}
        />
        <NoteField
          id={`improve-${date}`}
          label="¿Qué puedo mejorar mañana?"
          placeholder="Ej.: Dejar el móvil fuera de la habitación mientras estudio."
          value={improve}
          disabled={!editable}
          onChange={(v) => {
            setImprove(v);
            latest.current.improve = v;
            schedule();
          }}
          onBlur={() => void save()}
        />
        {error && state === "error" ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <p className="text-xs text-muted">🔒 Tus notas son privadas: nadie del grupo puede verlas.</p>
      </CardContent>
    </Card>
  );
}

function NoteField({
  id,
  label,
  placeholder,
  value,
  disabled,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="tabular text-xs text-muted" aria-hidden="true">
          {value.length}/{MAX}
        </span>
      </div>
      <Textarea
        id={id}
        value={value}
        maxLength={MAX}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}

function NotesStatus({ state }: { state: State }) {
  if (state === "saving" || state === "dirty") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted" role="status" aria-live="polite">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        {state === "saving" ? "Guardando…" : "Cambios sin guardar"}
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success" role="status" aria-live="polite">
        <CircleCheck className="size-3.5" aria-hidden="true" />
        Guardado
      </span>
    );
  }
  if (state === "error" || state === "conflict") {
    return (
      <span className="text-xs font-medium text-danger" role="status">
        Sin guardar
      </span>
    );
  }
  return null;
}
