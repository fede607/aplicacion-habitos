import { NextResponse } from "next/server";
import { getSession, hasFullAccess, type GroupSession } from "@/lib/data/session";
import { toCsv } from "@/lib/analytics";
import { WORKOUT_LABELS } from "@/lib/labels";
import { logServerError } from "@/lib/errors";
import { getSiteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { done: "hecho", missed: "no hecho", skipped: "no aplica" };
const MAX_ROWS = 20_000;

/**
 * Exportación de datos (Pro): tus hábitos, entrenos y notas en un CSV.
 * Sólo datos propios (RLS con la sesión del usuario), nunca de otros.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.activeGroup && !(await hasFullAccess(session as GroupSession))) {
    return NextResponse.redirect(new URL("/pro?locked=1", getSiteUrl()), 303);
  }
  const { supabase, userId, groups } = session;

  try {
    const [logsRes, habitsRes, workoutsRes, notesRes] = await Promise.all([
      supabase.from("habit_logs").select("habit_id, group_id, log_date, status").eq("user_id", userId).order("log_date").limit(MAX_ROWS),
      supabase.from("habits").select("id, name").in("group_id", groups.map((g) => g.id)),
      supabase.from("workouts").select("workout_date, type, duration_min, intensity, feeling, exercises, notes").eq("user_id", userId).order("workout_date").limit(MAX_ROWS),
      supabase.from("daily_entries").select("entry_date, did_today, improve_tomorrow").eq("user_id", userId).order("entry_date").limit(MAX_ROWS),
    ]);
    for (const r of [logsRes, habitsRes, workoutsRes, notesRes]) if (r.error) throw r.error;

    const habitName = new Map((habitsRes.data ?? []).map((h) => [h.id, h.name]));
    const groupName = new Map(groups.map((g) => [g.id, g.name]));
    const rows: unknown[][] = [];
    for (const l of logsRes.data ?? []) {
      rows.push(["hábito", l.log_date, groupName.get(l.group_id) ?? "", habitName.get(l.habit_id) ?? "(hábito eliminado)", STATUS[l.status] ?? l.status, ""]);
    }
    for (const w of workoutsRes.data ?? []) {
      const detail = [w.exercises, w.notes].filter(Boolean).join(" · ");
      rows.push(["entreno", w.workout_date, "", WORKOUT_LABELS[w.type] ?? w.type, `${w.duration_min} min`, `intensidad ${w.intensity ?? "—"} · sensación ${w.feeling ?? "—"}${detail ? ` · ${detail}` : ""}`]);
    }
    for (const n of notesRes.data ?? []) {
      if (!n.did_today && !n.improve_tomorrow) continue;
      rows.push(["nota", n.entry_date, "", "diario", "", `Hoy: ${n.did_today} · Mañana: ${n.improve_tomorrow}`]);
    }
    rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])));

    // BOM para que Excel abra bien los acentos.
    const csv = "﻿" + toCsv(["tipo", "fecha", "grupo", "elemento", "valor", "detalle"], rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="year-arc-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    logServerError("export", e);
    return NextResponse.json({ error: "export failed" }, { status: 500 });
  }
}
