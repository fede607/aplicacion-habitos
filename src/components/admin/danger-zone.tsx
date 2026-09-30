"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteGroup, leaveGroup } from "@/app/actions/groups";
import { Button } from "@/components/ui/button";

export function LeaveGroupButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`¿Salir de «${groupName}»? Tus registros se conservan pero dejarás de ver el grupo.`)) return;
        startTransition(async () => {
          const res = await leaveGroup(groupId);
          if (res && !res.ok) toast.error(res.error);
        });
      }}
    >
      Salir del grupo
    </Button>
  );
}

export function DeleteGroupButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="danger"
      disabled={pending}
      onClick={() => {
        const typed = window.prompt(`Esto elimina el grupo para todos. Escribe el nombre del grupo para confirmar:\n${groupName}`);
        if (typed !== groupName) {
          if (typed !== null) toast.error("El nombre no coincide.");
          return;
        }
        startTransition(async () => {
          const res = await deleteGroup(groupId);
          if (res && !res.ok) toast.error(res.error);
        });
      }}
    >
      Eliminar grupo
    </Button>
  );
}
