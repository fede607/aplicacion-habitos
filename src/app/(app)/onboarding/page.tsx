import type { Metadata } from "next";
import { Snowflake, Users } from "lucide-react";
import { requireSession } from "@/lib/data/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { JoinByCodeForm } from "@/components/groups/join-by-code-form";

export const metadata: Metadata = { title: "Empezar" };

export default async function OnboardingPage() {
  const { profile, today, groups } = await requireSession();
  return (
    <div className="grid gap-6">
      <header>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          {groups.length ? "Nuevo grupo" : "Bienvenido"}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {groups.length ? "Crea o únete a otro grupo" : `Hola, ${profile.display_name}`}
        </h1>
        <p className="mt-1 text-muted">
          {profile.can_create_groups
            ? "El Winter Arc se hace en grupo. Crea uno e invita a tus amigos, o únete con un código."
            : "Winter Arc es sólo por invitación. Únete a un grupo con el enlace o el código que te hayan enviado."}
        </p>
      </header>
      <div className={profile.can_create_groups ? "grid gap-5 lg:grid-cols-2" : "grid max-w-xl gap-5"}>
        {profile.can_create_groups ? (
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Snowflake className="size-4 text-primary" aria-hidden="true" /> Crear un grupo
                </CardTitle>
                <CardDescription>Serás el administrador.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <CreateGroupForm today={today} />
            </CardContent>
          </Card>
        ) : null}
        <Card className="self-start">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" aria-hidden="true" /> Unirme con un código
              </CardTitle>
              <CardDescription>Pide el enlace o el código a quien administre el grupo.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <JoinByCodeForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
