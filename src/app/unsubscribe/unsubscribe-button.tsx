"use client";

import { useState, useTransition } from "react";
import { CircleCheck } from "lucide-react";
import { unsubscribeFromEmails } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";

export function UnsubscribeButton({ token }: { token: string }) {
  const [done, setDone] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();
  if (done) {
    return (
      <p
        role="status"
        className="flex items-center justify-center gap-2 font-medium text-success"
      >
        <CircleCheck className="size-5" aria-hidden="true" /> Te has dado de
        baja.
      </p>
    );
  }
  return (
    <>
      {done === false ? (
        <p role="alert" className="text-sm text-danger">
          No se ha podido completar. El enlace puede haber caducado.
        </p>
      ) : null}
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setDone(await unsubscribeFromEmails(token));
          })
        }
      >
        Darme de baja
      </Button>
    </>
  );
}
