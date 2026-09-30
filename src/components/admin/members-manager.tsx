"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crown, UserMinus } from "lucide-react";
import { formatDateOnly } from "@/lib/dates";
import {
  removeMember,
  setMemberRole,
  transferAdmin,
} from "@/app/actions/groups";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type AdminMember = {
  userId: string;
  name: string;
  username: string;
  emoji: string | null;
  color: string;
  role: "admin" | "member";
  joinedAt: string;
};

export function MembersManager({
  groupId,
  members,
  meId,
  timeZone,
}: {
  groupId: string;
  members: AdminMember[];
  meId: string;
  timeZone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <ul className="grid gap-2">
      {members.map((m) => {
        const isMe = m.userId === meId;
        return (
          <li
            key={m.userId}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3"
          >
            <Avatar name={m.name} emoji={m.emoji} color={m.color} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {m.name}{" "}
                {isMe ? (
                  <span className="font-normal text-muted">(tú)</span>
                ) : null}
              </p>
              <p className="truncate text-xs text-muted">
                @{m.username} · desde {formatDateOnly(m.joinedAt, timeZone)}
              </p>
            </div>
            {m.role === "admin" ? <Badge tone="primary">Admin</Badge> : null}
            {!isMe ? (
              <div className="flex flex-wrap gap-1.5">
                {m.role === "member" ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            setMemberRole({
                              groupId,
                              userId: m.userId,
                              role: "admin",
                            }),
                          `${m.name} ahora es admin`,
                        )
                      }
                    >
                      Hacer admin
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `¿Transferir la administración a ${m.name}? Dejarás de ser admin.`,
                          )
                        )
                          run(
                            () => transferAdmin({ groupId, userId: m.userId }),
                            "Administración transferida",
                          );
                      }}
                    >
                      <Crown aria-hidden="true" /> Transferir
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      disabled={pending}
                      aria-label={`Expulsar a ${m.name}`}
                      onClick={() => {
                        if (window.confirm(`¿Expulsar a ${m.name} del grupo?`))
                          run(
                            () => removeMember({ groupId, userId: m.userId }),
                            `${m.name} ha salido del grupo`,
                          );
                      }}
                    >
                      <UserMinus aria-hidden="true" />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () =>
                          setMemberRole({
                            groupId,
                            userId: m.userId,
                            role: "member",
                          }),
                        `${m.name} ya no es admin`,
                      )
                    }
                  >
                    Quitar admin
                  </Button>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
