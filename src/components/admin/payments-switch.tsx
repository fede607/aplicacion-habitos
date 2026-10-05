"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gift, Wallet } from "lucide-react";
import { staffSetPaymentsOpen } from "@/app/actions/access";
import { Button } from "@/components/ui/button";

/** Interruptor de la venta de Pro: cerrada = Pro gratis para todos y sin precios. */
export function PaymentsSwitch({ open }: { open: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3 text-sm ${open ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}>
      <span className="flex items-center gap-2 font-semibold">
        {open ? <Wallet className="size-4" aria-hidden="true" /> : <Gift className="size-4" aria-hidden="true" />}
        {open ? "Pagos activados: se ven los precios y PayPal" : "Pagos desactivados: Pro gratis para todos, sin precios"}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const msg = open
              ? "¿Desactivar los pagos? Pro volverá a ser gratis para todos y se ocultarán los precios."
              : "¿Activar los pagos? Se mostrarán los precios y los botones de PayPal. Todos los usuarios recibirán 1 mes de Pro gratis desde hoy y después tendrán que pagar para seguir con Pro.";
            if (!window.confirm(msg)) return;
            const res = await staffSetPaymentsOpen(!open);
            if (!res.ok) return void toast.error(res.error);
            toast.success(open ? "Pagos desactivados" : "Pagos activados");
            router.refresh();
          })
        }
      >
        {open ? "Desactivar pagos" : "Activar pagos"}
      </Button>
    </div>
  );
}
