import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireSession } from "@/lib/data/session";
import { JoinByCodeForm } from "@/components/groups/join-by-code-form";
import { StartSoloButton } from "@/components/groups/start-solo-button";

export const metadata: Metadata = { title: "Empezar" };

export default async function OnboardingPage() {
  const { supabase, profile, groups } = await requireSession();
  const { data: canCreate } = await supabase.rpc("i_can_invite");
  return (
    <div className="mx-auto grid max-w-md gap-6 pt-4">
      <header className="text-center">
        <p className="text-4xl" aria-hidden="true">
          🟩
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">{groups.length ? "Otro Year Arc" : `Hola, ${profile.display_name.split(" ")[0]}`}</h1>
        <p className="mt-2 text-muted">Elige tus hábitos y mira cómo sube tu línea de constancia día a día.</p>
      </header>
      {canCreate ? (
        <StartSoloButton />
      ) : (
        <p className="rounded-3xl border border-primary/30 bg-primary-soft p-4 text-center text-sm">
          Year Arc está en acceso privado: para empezar, pide al equipo de Year Arc el enlace de tu grupo y ábrelo. Entrarás directamente.
        </p>
      )}
      <details className="group rounded-3xl border border-border bg-surface" open={!canCreate}>
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 font-semibold [&::-webkit-details-marker]:hidden">
          <Users className="size-5 text-primary" aria-hidden="true" /> Tengo un código de un amigo
        </summary>
        <div className="px-4 pb-4">
          <JoinByCodeForm />
        </div>
      </details>
    </div>
  );
}
