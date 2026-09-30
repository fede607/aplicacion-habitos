"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Refresca el panel del grupo cuando cualquier miembro registra un hábito.
 * Supabase Realtime aplica RLS: sólo llegan eventos que el usuario puede leer.
 */
export function GroupRealtime({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`group-logs-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "habit_logs",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 1500);
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [groupId, router]);

  if (!live) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium text-success"
      role="status"
    >
      <span
        className="size-2 animate-pulse rounded-full bg-success"
        aria-hidden="true"
      />
      En directo
    </span>
  );
}
