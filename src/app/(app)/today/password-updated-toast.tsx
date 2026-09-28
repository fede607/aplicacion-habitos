"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function PasswordUpdatedToast({ show }: { show: boolean }) {
  useEffect(() => {
    if (show) toast.success("Contraseña actualizada");
  }, [show]);
  return null;
}
