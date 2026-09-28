"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function NewAchievementsToast({ codes, names }: { codes: string[]; names: Record<string, string> }) {
  useEffect(() => {
    for (const code of codes) toast.success(`¡Nuevo logro! ${names[code] ?? code}`);
  }, [codes, names]);
  return null;
}
