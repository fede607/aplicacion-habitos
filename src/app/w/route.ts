import { NextResponse, type NextRequest } from "next/server";
import { SOURCE_COOKIE, cleanSource } from "@/lib/signup-source";

/**
 * Enlace corto para campañas: /w (WhatsApp) o /w?s=instagram. Guarda el origen
 * 30 días para atribuir el registro y lleva a la portada.
 */
export function GET(request: NextRequest) {
  const source = cleanSource(request.nextUrl.searchParams.get("s")) ?? "whatsapp";
  const res = NextResponse.redirect(new URL(`/?utm_source=${source}&utm_medium=social`, request.url), 302);
  res.cookies.set(SOURCE_COOKIE, source, { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", httpOnly: true, secure: true });
  return res;
}
