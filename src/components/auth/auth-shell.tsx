import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="aurora flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8" aria-label="Year Arc, inicio">
        <Logo />
      </Link>
      <main className="w-full max-w-sm">{children}</main>
    </div>
  );
}
