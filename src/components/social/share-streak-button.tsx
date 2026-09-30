"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { LoaderCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Comparte la imagen de tu racha (Instagram, WhatsApp…) o la descarga si el navegador no permite compartir archivos. */
export function ShareStreakButton({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const share = () =>
    start(async () => {
      try {
        const res = await fetch("/api/share/streak", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const file = new File([blob], "mi-racha-year-arc.png", {
          type: "image/png",
        });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Mi racha en Year Arc",
            text: "Mi racha en Year Arc 🔥 ¿Te unes?",
          });
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast.success("Imagen descargada: súbela a tu historia");
      } catch (e) {
        if ((e as Error)?.name !== "AbortError")
          toast.error("No se ha podido crear la imagen.");
      }
    });
  return (
    <Button
      variant={compact ? "secondary" : "pro"}
      size={compact ? "sm" : "md"}
      disabled={pending}
      onClick={share}
      className={className}
      aria-label="Compartir mi racha"
    >
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <Share2 aria-hidden="true" />
      )}
      {compact ? "Compartir" : "Compartir mi racha"}
    </Button>
  );
}
