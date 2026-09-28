// Genera claves anon/service_role (JWT HS256) para el stack local de pruebas.
// NUNCA uses este secreto fuera de desarrollo local.
import { createHmac } from "node:crypto";

export const LOCAL_JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function signJwt(payload, secret = LOCAL_JWT_SECRET) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 5;
export const anonKey = signJwt({ iss: "supabase-local", role: "anon", exp });
export const serviceRoleKey = signJwt({ iss: "supabase-local", role: "service_role", exp });

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`);
}
