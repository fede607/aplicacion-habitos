"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { timeInTimeZone } from "@/lib/dates";

/**
 * Recordatorio in-app no intrusivo: aparece sólo si el usuario lo activó, ya
 * pasó su hora configurada y le quedan hábitos del día por marcar.
 */
export function ReminderBanner({
  enabled,
  reminderTime,
  timezone,
  pendingHabits,
}: {
  enabled: boolean;
  reminderTime: string;
  timezone: string;
  pendingHabits: number;
}) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(timeInTimeZone(timezone));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [timezone]);

  if (!enabled || !now || pendingHabits === 0 || now < reminderTime.slice(0, 5))
    return null;
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm"
    >
      <Bell className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <p>
        Son las <strong className="tabular">{now}</strong>. Te quedan{" "}
        <strong>{pendingHabits}</strong> hábitos por marcar hoy.
      </p>
    </div>
  );
}
