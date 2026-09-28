import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runNotifications } from "@/lib/notifications/run";
import { isEmailConfigured } from "@/lib/email/mailer";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Lo llama un cron cada hora (GitHub Actions, Vercel Cron o pg_cron). */
async function handle(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isEmailConfigured() || !isAdminConfigured()) {
    return NextResponse.json({ error: "email or service role not configured" }, { status: 503 });
  }
  try {
    const result = await runNotifications();
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    logServerError("cron:notifications", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
