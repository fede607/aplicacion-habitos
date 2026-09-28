"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Globe } from "lucide-react";
import { updateTimezone } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";

const noop = () => () => {};

/** Avisa si el dispositivo está en otra zona horaria distinta a la del perfil. */
export function TimezoneMismatch({ profileTimezone }: { profileTimezone: string }) {
  const deviceTz = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => profileTimezone,
  );
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();
  if (dismissed || !deviceTz || deviceTz === profileTimezone) return null;

  return (
    <div role="status" className="border-t border-border bg-primary-soft">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-sm sm:px-6">
        <Globe className="size-4 text-primary" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          Tu dispositivo está en <strong>{deviceTz}</strong> y tu perfil en <strong>{profileTimezone}</strong>. Los días se
          cuentan con la zona del perfil.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await updateTimezone(deviceTz);
                if (res.ok) toast.success("Zona horaria actualizada");
                else toast.error(res.error);
              })
            }
          >
            Usar {deviceTz.split("/").pop()?.replace(/_/g, " ")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Mantener
          </Button>
        </div>
      </div>
    </div>
  );
}
