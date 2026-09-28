"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { joinGroup } from "@/app/actions/groups";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function JoinByCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await joinGroup(code);
          if (res.ok) {
            toast.success("¡Te has unido al grupo!");
            router.push("/today");
          } else {
            setError(res.error);
          }
        });
      }}
    >
      <Field label="Código de invitación" htmlFor="invite-code" error={error} hint="12 caracteres, por ejemplo ABCD-EFGH-JKLM">
        <Input
          id="invite-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={20}
          className="tabular font-mono tracking-widest uppercase"
          required
          aria-invalid={!!error}
        />
      </Field>
      <Button type="submit" size="lg" variant="secondary" disabled={pending || code.trim().length < 12}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
        Unirme
      </Button>
    </form>
  );
}
