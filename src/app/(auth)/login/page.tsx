import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  return (
    <div className="grid gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Bienvenido de vuelta</h1>
        <p className="mt-1 text-sm text-muted">Tu Winter Arc te está esperando.</p>
      </div>
      <div className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <LoginForm next={next} />
      </div>
      <p className="text-center text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-semibold text-primary hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
