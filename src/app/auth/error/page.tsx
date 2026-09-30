import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <AuthShell>
      <div className="grid gap-4 rounded-3xl border border-border bg-surface p-6 text-center shadow-card">
        <h1 className="text-xl font-bold">Enlace no válido</h1>
        <p className="text-sm text-muted">El enlace ha caducado o ya se ha usado. Solicita uno nuevo.</p>
        <Button asChild>
          <Link href="/login">Ir a entrar</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
