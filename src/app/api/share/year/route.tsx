import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/data/session";
import { getYearPixels } from "@/lib/data/year";
import { MONTH_SHORT, PIXEL_COLORS, type YearPixels } from "@/lib/year-pixels";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";

function YearCard({ name, data }: { name: string; data: YearPixels }) {
  const cell = 24;
  const gap = 4;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "130px 60px 110px",
        background: "linear-gradient(160deg, #060a12 0%, #0b2540 60%, #1a0b2e 100%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 40, letterSpacing: 8, color: "#7dd3fc", fontWeight: 800 }}>YEAR ARC</div>
        <div style={{ display: "flex", fontSize: 88, fontWeight: 900, marginTop: 24 }}>Mi {data.year}</div>
        <div style={{ display: "flex", fontSize: 40, color: "#cbd5e1", marginTop: 8 }}>{name}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {data.months.map((days, m) => (
          <div key={m} style={{ display: "flex", alignItems: "center", gap }}>
            <div style={{ display: "flex", width: 70, fontSize: 24, color: "#94a3b8", fontWeight: 700 }}>{MONTH_SHORT[m]}</div>
            {days.map((p) => (
              <div key={p.date} style={{ display: "flex", width: cell, height: cell, borderRadius: 6, backgroundColor: PIXEL_COLORS[String(p.level)] }} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 32 }}>
        {[
          [String(data.perfectDays), "días perfectos"],
          [data.bestMonth !== null ? MONTH_SHORT[data.bestMonth] : "—", "mejor mes"],
        ].map(([v, l]) => (
          <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 44px", borderRadius: 32, background: "rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 800 }}>{v}</div>
            <div style={{ display: "flex", fontSize: 30, color: "#cbd5e1" }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", fontSize: 34, color: "#94a3b8" }}>Pinta el tuyo: winterarc-2026.vercel.app/w</div>
    </div>
  );
}

/** Imagen 1080×1920 (formato estado) con el año en píxeles del usuario. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!session.activeGroup) return NextResponse.json({ error: "no group" }, { status: 404 });

  let data: YearPixels;
  try {
    data = await getYearPixels(session.supabase, session.activeGroup.id, session.userId, session.today);
  } catch (e) {
    logServerError("share:year", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return new ImageResponse(<YearCard name={session.profile.display_name.slice(0, 24)} data={data} />, {
    width: 1080,
    height: 1920,
    headers: { "Cache-Control": "private, no-store" },
  });
}
