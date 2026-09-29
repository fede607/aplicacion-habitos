"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, Sparkles } from "lucide-react";
import { cancelSubscription, startPaypalCheckout } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";

export function SubscribeButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="pro"
      size="xl"
      className="w-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startPaypalCheckout();
          if (res && !res.ok) toast.error(res.error);
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
      Hacerse Pro con PayPal · 2 €/mes
    </Button>
  );
}

export function CancelButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("¿Cancelar la suscripción? Seguirás siendo Pro hasta el final del mes ya pagado y no se te cobrará más.")) return;
        start(async () => {
          const res = await cancelSubscription();
          if (res.ok) {
            toast.success("Suscripción cancelada: no se te cobrará más");
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
      Cancelar suscripción
    </Button>
  );
}
