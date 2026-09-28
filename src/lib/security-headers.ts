/** Cabeceras de seguridad y Content Security Policy con nonce por petición. */
export function buildCsp(nonce: string, supabaseUrl: string, isDev: boolean): string {
  let supabaseOrigin = "";
  let supabaseWs = "";
  try {
    const u = new URL(supabaseUrl);
    supabaseOrigin = u.origin;
    supabaseWs = `${u.protocol === "https:" ? "wss:" : "ws:"}//${u.host}`;
  } catch {
    // URL inválida: la app fallará al iniciar el cliente, no aquí.
  }
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${supabaseOrigin} ${supabaseWs}${isDev ? " ws: http://localhost:* http://127.0.0.1:*" : ""}`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
