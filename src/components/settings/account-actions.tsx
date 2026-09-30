"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { deleteAccount } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
    >
      <LogOut aria-hidden="true" /> Cerrar sesión
    </Button>
  );
}

export function DeleteAccountForm() {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await deleteAccount(value);
          if (res && !res.ok) toast.error(res.error);
        });
      }}
    >
      <Field
        label='Escribe "BORRAR" para eliminar tu cuenta y todos tus datos'
        htmlFor="delete-confirm"
      >
        <Input
          id="delete-confirm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
        />
      </Field>
      <Button
        type="submit"
        variant="danger"
        disabled={pending || value !== "BORRAR"}
        className="justify-self-start"
      >
        Eliminar mi cuenta
      </Button>
    </form>
  );
}
