import { NextResponse } from "next/server";
import { getSession } from "@/lib/data/session";
import { toCsv } from "@/lib/analytics";
import { WORKOUT_LABELS } from "@/lib/labels";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { done: "hecho", missed: "no hecho", skipped: "no aplica" };
const PAGE = 1000; // tope por petición de PostgREST: se pide por páginas
const MAX_ROWS = 20_000;

/** Trae todas las filas por páginas (PostgREST corta en 1000 por petición). */
async function all<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/**
 * Exportación de tus datos (gratis para todos: derecho de acceso y portabilidad,
 * RGPD arts. 15 y 20): cuenta, preferencias, datos físicos, hábitos, entrenos,
 * notas y opiniones en un CSV. Sólo datos propios (RLS con la sesión del usuario).
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { supabase, userId, groups, email, profile, settings } = session;

  try {
    const [logs, workouts, notes, habitsRes, trainingRes, reviewsRes] = await Promise.all([
      all((f, t) => supabase.from("habit_logs").select("habit_id, group_id, log_date, status").eq("user_id", userId).order("log_date").range(f, t)),
      all((f, t) => supabase.from("workouts").select("workout_date, type, duration_min, intensity, feeling, exercises, notes").eq("user_id", userId).order("workout_date").range(f, t)),
      all((f, t) => supabase.from("daily_entries").select("entry_date, did_today, improve_tomorrow").eq("user_id", userId).order("entry_date").range(f, t)),
      supabase.from("habits").select("id, name").in("group_id", groups.map((g) => g.id)),
      supabase.from("training_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("reviews").select("rating, body, created_at").eq("user_id", userId),
    ]);
    if (habitsRes.error) throw habitsRes.error;

    // Datos de la cuenta y preferencias (primero en el archivo).
    const account: unknown[][] = [
      ["cuenta", profile.created_at?.slice(0, 10) ?? "", "", "email", email, ""],
      ["cuenta", "", "", "nombre", profile.display_name, ""],
      ["cuenta", "", "", "usuario", `@${profile.username}`, ""],
      ["cuenta", "", "", "zona horaria", profile.timezone, ""],
      ...groups.map((g) => ["cuenta", "", g.name, "grupo", g.role ?? "", ""]),
      ["preferencias", "", "", "recordatorios", settings.reminder_enabled ? `sí, ${settings.reminder_time}` : "no", ""],
      ["preferencias", "", "", "compartir hábitos con el grupo", settings.share_habits ? "sí" : "no", ""],
      ["preferencias", "", "", "compartir entrenos con el grupo", settings.share_workouts ? "sí" : "no", ""],
      ["preferencias", "", "", "aparecer en comparativas", settings.show_in_comparison ? "sí" : "no", ""],
      ["preferencias", settings.marketing_consent_at?.slice(0, 10) ?? "", "", "novedades y ofertas", settings.marketing_push ? "sí" : "no", ""],
    ];
    const tp = trainingRes.data as Record<string, unknown> | null;
    if (tp) {
      for (const [k, v] of Object.entries(tp)) {
        if (k === "user_id") continue;
        account.push(["datos físicos", "", "", k, Array.isArray(v) ? v.join(" ") : v, ""]);
      }
    }
    for (const r of reviewsRes.data ?? []) account.push(["opinión", String(r.created_at).slice(0, 10), "", `${r.rating} estrellas`, "", r.body ?? ""]);

    const habitName = new Map((habitsRes.data ?? []).map((h) => [h.id, h.name]));
    const groupName = new Map(groups.map((g) => [g.id, g.name]));
    const rows: unknown[][] = [];
    for (const l of logs) {
      rows.push(["hábito", l.log_date, groupName.get(l.group_id) ?? "", habitName.get(l.habit_id) ?? "(hábito eliminado)", STATUS[l.status] ?? l.status, ""]);
    }
    for (const w of workouts) {
      const detail = [w.exercises, w.notes].filter(Boolean).join(" · ");
      rows.push(["entreno", w.workout_date, "", WORKOUT_LABELS[w.type] ?? w.type, `${w.duration_min} min`, `intensidad ${w.intensity ?? "—"} · sensación ${w.feeling ?? "—"}${detail ? ` · ${detail}` : ""}`]);
    }
    for (const n of notes) {
      if (!n.did_today && !n.improve_tomorrow) continue;
      rows.push(["nota", n.entry_date, "", "diario", "", `Hoy: ${n.did_today} · Mañana: ${n.improve_tomorrow}`]);
    }
    rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])));

    // BOM para que Excel abra bien los acentos.
    const csv = "﻿" + toCsv(["tipo", "fecha", "grupo", "elemento", "valor", "detalle"], [...account, ...rows]);
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
