import { NextResponse, type NextRequest } from "next/server";
import { cleanSource } from "@/lib/signup-source";

/**
 * Enlace corto para campañas: /w (WhatsApp) o /w?s=instagram. El origen viaja en la
 * URL (?src=) hasta el registro: sin cookie de seguimiento, que exigiría consentimiento.
 */
export function GET(request: NextRequest) {
  const source = cleanSource(request.nextUrl.searchParams.get("s")) ?? "whatsapp";
  return NextResponse.redirect(new URL(`/?src=${source}`, request.url), 302);
}
