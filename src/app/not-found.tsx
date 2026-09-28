import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <AuthShell>
      <div className="grid gap-4 rounded-3xl border border-border bg-surface p-6 text-center shadow-card">
        <p className="text-5xl" aria-hidden="true">🧊</p>
        <h1 className="text-xl font-bold">Página no encontrada</h1>
        <p className="text-sm text-muted">Puede que no exista o que no tengas acceso.</p>
        <Button asChild>
          <Link href="/today">Volver a hoy</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
