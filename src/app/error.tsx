"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Sólo el digest: el mensaje real queda en los logs del servidor.
    console.error("[winter-arc] UI error", error.digest);
  }, [error]);
  return (
    <div className="mx-auto grid max-w-md gap-4 px-4 py-16 text-center">
      <p className="text-4xl" aria-hidden="true">⚠️</p>
      <h1 className="text-xl font-bold">Algo ha fallado</h1>
      <p className="text-sm text-muted">Ha ocurrido un error inesperado. Tus datos guardados están a salvo.</p>
      <div className="flex justify-center gap-2">
        <Button onClick={reset}>Reintentar</Button>
        <Button asChild variant="outline">
          <Link href="/today">Ir a hoy</Link>
        </Button>
      </div>
    </div>
  );
}
