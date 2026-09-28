import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  return (
    <div className="grid gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Empieza tu Winter Arc</h1>
        <p className="mt-1 text-sm text-muted">90 días de disciplina, con tus amigos.</p>
      </div>
      <div className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <RegisterForm next={next} />
      </div>
      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-primary hover:underline">
          Entra
        </Link>
      </p>
    </div>
  );
}
