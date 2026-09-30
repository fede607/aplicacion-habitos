"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { setHabitStatus } from "@/app/actions/tracking";
import type { HabitLogStatus } from "@/lib/database.types";

export type SaveState = "idle" | "saving" | "saved" | "retrying" | "error";
type Status = HabitLogStatus | null;

const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000];

/**
 * Sincroniza el estado de cada hábito con la BD:
 *  - Optimistic UI: el cambio se ve al instante.
 *  - Sólo se marca "Guardado" cuando el servidor confirma.
 *  - Errores de red: reintento con backoff y al recuperar la conexión.
 *  - Errores de validación/permisos: se revierte al último estado confirmado.
 *  - Varios clics seguidos: sólo se envía el último estado deseado.
 */
export function useHabitSync(date: string, initial: Record<string, Status>) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(initial);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const confirmed = useRef<Record<string, Status>>({ ...initial });
  const desired = useRef<Record<string, Status>>({ ...initial });
  const inFlight = useRef<Set<string>>(new Set());
  const attempts = useRef<Record<string, number>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [pendingCount, setPendingCount] = useState(0);
  // Referencia estable para reintentos programados (evita auto-referencias en useCallback).
  const flushRef = useRef<(habitId: string) => void>(() => {});

  const refreshPending = useCallback(() => {
    const ids = Object.keys(desired.current).filter(
      (id) => desired.current[id] !== confirmed.current[id],
    );
    setPendingCount(ids.length);
  }, []);

  const setSaveState = useCallback((habitId: string, state: SaveState) => {
    setSaveStates((prev) => ({ ...prev, [habitId]: state }));
  }, []);

  const flush = useCallback(
    async (habitId: string) => {
      if (inFlight.current.has(habitId)) return;
      const target = desired.current[habitId] ?? null;
      if (target === (confirmed.current[habitId] ?? null)) {
        setSaveState(habitId, "saved");
        refreshPending();
        return;
      }
      inFlight.current.add(habitId);
      setSaveState(habitId, attempts.current[habitId] ? "retrying" : "saving");
      try {
        const res = await setHabitStatus({ habitId, date, status: target });
        if (res.ok) {
          confirmed.current[habitId] = target;
          attempts.current[habitId] = 0;
          setSaveState(habitId, "saved");
        } else {
          // Error definitivo (validación, permisos, fecha no editable): revertir.
          desired.current[habitId] = confirmed.current[habitId] ?? null;
          setStatuses((prev) => ({
            ...prev,
            [habitId]: confirmed.current[habitId] ?? null,
          }));
          setSaveState(habitId, "error");
          toast.error(res.error);
        }
      } catch {
        // Error de red: reintentar con backoff.
        const n = (attempts.current[habitId] ?? 0) + 1;
        attempts.current[habitId] = n;
        setSaveState(habitId, "retrying");
        const delay = RETRY_DELAYS[Math.min(n - 1, RETRY_DELAYS.length - 1)];
        clearTimeout(timers.current[habitId]);
        timers.current[habitId] = setTimeout(
          () => flushRef.current(habitId),
          delay,
        );
      } finally {
        inFlight.current.delete(habitId);
        refreshPending();
      }
      // Si el usuario cambió de idea mientras se guardaba, enviar el último estado.
      if (
        desired.current[habitId] !== confirmed.current[habitId] &&
        !attempts.current[habitId]
      ) {
        flushRef.current(habitId);
      }
    },
    [date, refreshPending, setSaveState],
  );

  useEffect(() => {
    flushRef.current = (habitId: string) => void flush(habitId);
  }, [flush]);

  const update = useCallback(
    (habitId: string, status: Status) => {
      desired.current[habitId] = status;
      setStatuses((prev) => ({ ...prev, [habitId]: status }));
      refreshPending();
      void flush(habitId);
    },
    [flush, refreshPending],
  );

  // Al volver la conexión, reintentar todo lo pendiente.
  useEffect(() => {
    const onOnline = () => {
      for (const id of Object.keys(desired.current)) {
        if (desired.current[id] !== confirmed.current[id]) {
          clearTimeout(timers.current[id]);
          void flush(id);
        }
      }
    };
    window.addEventListener("online", onOnline);
    const currentTimers = timers.current;
    return () => {
      window.removeEventListener("online", onOnline);
      for (const t of Object.values(currentTimers)) clearTimeout(t);
    };
  }, [flush]);

  // Avisar antes de cerrar si hay cambios sin confirmar.
  useEffect(() => {
    if (pendingCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendingCount]);

  return { statuses, saveStates, update, pendingCount };
}
