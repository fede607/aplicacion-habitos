"use client";

import { toast } from "sonner";
import { Copy } from "lucide-react";

export function CopyText({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success("Copiado");
        } catch {
          toast.error("No se ha podido copiar");
        }
      }}
      className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-left text-sm hover:bg-surface-2"
    >
      <span className="flex-1">{text}</span>
      <Copy className="size-4 shrink-0 text-muted" aria-hidden="true" />
    </button>
  );
}
