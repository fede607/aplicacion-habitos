"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { LoaderCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Comparte la imagen de tu año en píxeles (o la descarga si no se puede compartir). */
export function ShareYearButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="pro"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const res = await fetch("/api/share/year", { cache: "no-store" });
            if (!res.ok) throw new Error(String(res.status));
            const blob = await res.blob();
            const file = new File([blob], "mi-ano-year-arc.png", { type: "image/png" });
            if (navigator.canShare?.({ files: [file] })) {
              await navigator.share({ files: [file], title: "Mi año en Year Arc", text: "Así va mi año 🔥 Hazte el tuyo: winterarc-2026.vercel.app/w" });
              return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = file.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            toast.success("Imagen descargada: súbela a tu estado");
          } catch (e) {
            if ((e as Error)?.name !== "AbortError") toast.error("No se ha podido crear la imagen.");
          }
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Share2 aria-hidden="true" />} Compartir
    </Button>
  );
}
