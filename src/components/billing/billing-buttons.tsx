"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, Sparkles } from "lucide-react";
import { cancelSubscription, startPaypalCheckout } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";

export function SubscribeButton({
  period = "month",
  label,
}: {
  period?: "month" | "year";
  label: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={period === "year" ? "pro" : "outline"}
      size="xl"
      className="w-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startPaypalCheckout(period);
          if (res && !res.ok) toast.error(res.error);
        })
      }
    >
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <Sparkles aria-hidden="true" />
      )}
      {label}
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
        if (
          !window.confirm(
            "¿Cancelar la suscripción? Seguirás siendo Pro hasta el final del mes ya pagado y no se te cobrará más.",
          )
        )
          return;
        start(async () => {
          const res = await cancelSubscription();
          if (res.ok) {
            toast.success("Suscripción cancelada: no se te cobrará más");
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : null}
      Cancelar suscripción
    </Button>
  );
}
