/** Rutas públicas (accesibles sin sesión). Todo lo demás exige sesión. */
const PUBLIC_EXACT = new Set(["/", "/login", "/register", "/forgot-password", "/offline", "/unsubscribe", "/notifications/verify", "/instalar"]);
// /api/* se autentica en cada route handler (secreto de cron o token de baja).
const PUBLIC_PREFIXES = ["/auth/", "/api/", "/join/"];
/** Páginas de autenticación: si ya hay sesión, se redirige a la app. */
const AUTH_PAGES = new Set(["/login", "/register", "/forgot-password"]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.has(pathname);
}

export const APP_HOME = "/today";
