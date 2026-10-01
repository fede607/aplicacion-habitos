"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { quickCreateGroup } from "@/app/actions/groups";
import { Button } from "@/components/ui/button";

/** Empezar en un toque: crea tu espacio (puedes invitar a amigos luego) y te lleva a elegir hábitos. */
export function StartSoloButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="pro"
      size="xl"
      className="w-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await quickCreateGroup();
          if (!res.ok) return void toast.error(res.error);
          router.push("/habits");
          router.refresh();
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
      Empezar mi Year Arc <ArrowRight aria-hidden="true" />
    </Button>
  );
}
