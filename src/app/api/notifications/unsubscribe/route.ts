import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

/** Baja con un clic (RFC 8058): los clientes de correo hacen POST a esta URL. */
export async function POST(request: NextRequest) {
  const token = uuidSchema.safeParse(request.nextUrl.searchParams.get("token"));
  if (!token.success) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("unsubscribe_emails", { p_token: token.data });
  return NextResponse.json({ ok: Boolean(data) });
}
