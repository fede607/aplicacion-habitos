"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, Sparkles } from "lucide-react";
import { cancelSubscription, resumeSubscription, startCheckout } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";

export function SubscribeButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      className="w-full sm:w-auto"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startCheckout();
          if (res && !res.ok) toast.error(res.error);
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
      Hacerse Pro · 2 €/mes
    </Button>
  );
}

export function CancelButton({ resume = false }: { resume?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={resume ? "primary" : "outline"}
      disabled={pending}
      onClick={() => {
        if (!resume && !window.confirm("¿Cancelar la suscripción? Seguirás siendo Pro hasta el final del periodo ya pagado y no se te cobrará más.")) return;
        start(async () => {
          const res = resume ? await resumeSubscription() : await cancelSubscription();
          if (res.ok) {
            toast.success(resume ? "Suscripción reactivada" : "Suscripción cancelada: no se te cobrará más");
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
      {resume ? "Reactivar suscripción" : "Cancelar suscripción"}
    </Button>
  );
}
