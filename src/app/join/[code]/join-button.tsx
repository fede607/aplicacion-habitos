"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { joinGroup } from "@/app/actions/groups";
import { Button } from "@/components/ui/button";

export function JoinButton({ code }: { code: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await joinGroup(code);
          if (res.ok) {
            toast.success("¡Bienvenido al grupo!");
            router.push("/today");
          } else {
            toast.error(res.error);
          }
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
      Unirme al grupo
    </Button>
  );
}
