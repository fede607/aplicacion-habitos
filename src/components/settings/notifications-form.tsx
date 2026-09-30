"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleCheck, LoaderCircle, Mail, TriangleAlert } from "lucide-react";
import {
  requestNotificationEmail,
  updateEmailPreferences,
  switchToAccountEmail,
} from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export type NotificationState = {
  accountEmail: string;
  accountConfirmed: boolean;
  customEmail: string | null;
  customVerified: boolean;
  pendingEmail: string | null;
  daily: boolean;
  weekly: boolean;
  reminderTime: string;
  emailConfigured: boolean;
};

export function NotificationsForm({ state }: { state: NotificationState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [daily, setDaily] = useState(state.daily);
  const [weekly, setWeekly] = useState(state.weekly);
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(state.pendingEmail ?? "");
  const [error, setError] = useState<string | undefined>();

  const deliveryEmail =
    state.customEmail && state.customVerified
      ? state.customEmail
      : state.accountConfirmed
        ? state.accountEmail
        : null;

  const savePrefs = (next: { daily: boolean; weekly: boolean }) =>
    startTransition(async () => {
      const res = await updateEmailPreferences(next);
      if (res.ok) toast.success("Preferencias de email guardadas ✓");
      else {
        toast.error(res.error);
        setDaily(state.daily);
        setWeekly(state.weekly);
      }
    });

  return (
    <div className="grid gap-5">
      {!state.emailConfigured ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning"
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          El envío de emails aún no está activado en el servidor. Tus
          preferencias se guardan y empezarán a funcionar cuando se configure.
        </p>
      ) : null}

      <div className="grid gap-2 rounded-xl bg-surface-2 p-3">
        <p className="text-sm font-medium">Enviar a</p>
        <p className="flex items-center gap-2 text-sm break-all">
          <Mail className="size-4 shrink-0 text-muted" aria-hidden="true" />
          {deliveryEmail ?? (
            <span className="text-muted">Ningún email verificado todavía</span>
          )}
          {deliveryEmail ? (
            <CircleCheck
              className="size-4 shrink-0 text-success"
              aria-label="Verificado"
            />
          ) : null}
        </p>
        {state.pendingEmail ? (
          <p className="text-xs text-warning">
            Pendiente de confirmar: {state.pendingEmail}. Revisa ese buzón.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Cancelar" : "Usar otro email"}
          </Button>
          {state.customEmail ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await switchToAccountEmail();
                  if (res.ok) {
                    toast.success("Se usará el email de tu cuenta");
                    router.refresh();
                  } else toast.error(res.error);
                })
              }
            >
              Volver al email de la cuenta
            </Button>
          ) : null}
        </div>
        {editing ? (
          <form
            className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await requestNotificationEmail(email);
                if (res.ok) {
                  setError(undefined);
                  setEditing(false);
                  toast.success(
                    res.data === "sent"
                      ? "Te hemos enviado un enlace para confirmar el email."
                      : "Email actualizado ✓",
                  );
                  router.refresh();
                } else {
                  setError(res.fieldErrors?.email ?? res.error);
                }
              });
            }}
          >
            <Field
              label="Email para notificaciones"
              htmlFor="notify-email"
              error={error}
              hint="Te enviaremos un enlace para confirmarlo."
            >
              <Input
                id="notify-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : null}
              Verificar
            </Button>
          </form>
        ) : null}
      </div>

      <label
        htmlFor="email-daily"
        className="flex items-start justify-between gap-4 rounded-xl bg-surface-2 p-3"
      >
        <span>
          <span className="block text-sm font-medium">
            Recordatorio diario por email
          </span>
          <span className="block text-xs text-muted">
            A tu hora de recordatorio ({state.reminderTime.slice(0, 5)}), sólo
            si te quedan hábitos por marcar.
          </span>
        </span>
        <Switch
          id="email-daily"
          checked={daily}
          disabled={pending}
          onCheckedChange={(v) => {
            setDaily(v);
            savePrefs({ daily: v, weekly });
          }}
        />
      </label>
      <label
        htmlFor="email-weekly"
        className="flex items-start justify-between gap-4 rounded-xl bg-surface-2 p-3"
      >
        <span>
          <span className="block text-sm font-medium">
            Resumen semanal por email
          </span>
          <span className="block text-xs text-muted">
            Domingos a partir de las 19:00: tus estadísticas y las del grupo.
          </span>
        </span>
        <Switch
          id="email-weekly"
          checked={weekly}
          disabled={pending}
          onCheckedChange={(v) => {
            setWeekly(v);
            savePrefs({ daily, weekly: v });
          }}
        />
      </label>
      <p className="text-xs text-muted">
        Cada email incluye un enlace para darte de baja con un clic. Nunca
        compartimos tu correo.
      </p>
    </div>
  );
}
