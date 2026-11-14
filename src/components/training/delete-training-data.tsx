"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { LoaderCircle, Trash2 } from "lucide-react";
import { deleteTrainingProfile } from "@/app/actions/training";
import { Button } from "@/components/ui/button";

/** Retirar el consentimiento de datos físicos (RGPD art. 7.3): tan fácil como darlo. */
export function DeleteTrainingData() {
  const [pending, start] = useTransition();
  return (
    <div className="mt-4 grid gap-2 border-t border-border pt-4">
      <p className="text-xs text-muted">Si ya no quieres que guardemos tu edad, sexo, altura, peso y molestias, bórralos. Tu plan dejará de calcularse.</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("¿Borrar tus datos físicos? Tu plan de entreno dejará de calcularse.")) return;
          start(async () => {
            const res = await deleteTrainingProfile();
            if (!res.ok) return void toast.error(res.error);
            toast.success("Datos físicos borrados.");
          });
        }}
      >
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />} Borrar mis datos físicos
      </Button>
    </div>
  );
}
