"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Muestra una clave de recuperación con botones para copiarla o descargarla. */
export function CodeBox({ code, emailedTo }: { code: string; emailedTo?: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-3">
      <p className="rounded-2xl border-2 border-dashed border-primary bg-primary-soft p-4 text-center font-mono text-xl font-black tracking-widest select-all sm:text-2xl">{code}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {}
          }}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? "Copiada" : "Copiar"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            const blob = new Blob([`Clave de recuperación de Year Arc\n\n${code}\n\nÚsala en winterarc-2026.vercel.app/forgot-password si olvidas tu contraseña.\n`], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "clave-year-arc.txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }}
        >
          <Download aria-hidden="true" /> Guardar
        </Button>
      </div>
      {emailedTo !== undefined ? (
        <p className={`rounded-xl px-3 py-2 text-sm ${emailedTo ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
          {emailedTo ? `📧 También te la hemos enviado a ${emailedTo}.` : "No hemos podido enviártela por email: cópiala o guárdala ahora."}
        </p>
      ) : null}
      <p className="text-xs text-muted">Guárdala donde no la pierdas (captura, notas o gestor de contraseñas). No la compartas con nadie: sólo se muestra ahora.</p>
    </div>
  );
}
