import type { OAuthProvider } from "@/lib/auth-providers";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6H1.4a12 12 0 0 0 0 10.9l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
      <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9a4.8 4.8 0 0 0-3.8-2c-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9a5 5 0 0 0-4.2 2.6c-1.8 3.1-.5 7.6 1.3 10.1.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-4.1ZM13.9 5a4.4 4.4 0 0 0 1-3.2 4.5 4.5 0 0 0-2.9 1.5 4.2 4.2 0 0 0-1 3.1c1.1.1 2.2-.6 2.9-1.4Z" />
    </svg>
  );
}

const LABELS: Record<OAuthProvider, string> = {
  google: "Continuar con Google",
  apple: "Continuar con Apple",
};

/** Botones de login social. Son enlaces al servidor (/auth/oauth), sin JavaScript. */
export function OAuthButtons({
  providers,
  invite,
  next,
}: {
  providers: OAuthProvider[];
  invite?: string | null;
  next?: string;
}) {
  if (!providers.length) return null;
  const href = (p: OAuthProvider) => {
    const q = new URLSearchParams({ provider: p });
    if (invite) q.set("invite", invite);
    if (next) q.set("next", next);
    return `/auth/oauth?${q.toString()}`;
  };
  return (
    <div className="grid gap-3">
      {providers.map((p) => (
        <a
          key={p}
          href={href(p)}
          className={
            p === "apple"
              ? "inline-flex h-12 items-center justify-center gap-3 rounded-xl bg-black px-4 text-sm font-semibold text-white hover:brightness-125"
              : "inline-flex h-12 items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-[#1f1f1f] hover:bg-gray-50"
          }
        >
          {p === "google" ? <GoogleIcon /> : <AppleIcon />}
          {LABELS[p]}
        </a>
      ))}
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" /> o con tu correo{" "}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
