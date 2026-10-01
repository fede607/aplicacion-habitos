import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/data/session";
import { getYearLine } from "@/lib/data/year";
import { linePath, type YearLine } from "@/lib/year-line";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const CW = 940;
const CH = 620;

function YearCard({ name, data }: { name: string; data: YearLine }) {
  const path = linePath(data.points, CW, CH);
  const n = data.points.length;
  const lastIdx = data.points.findLastIndex((p) => p.value !== null);
  const area = n > 1 && path ? `${path} L${((lastIdx / (n - 1)) * CW).toFixed(1)} ${CH} L0 ${CH} Z` : "";
  const last = lastIdx >= 0 ? data.points[lastIdx] : null;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "130px 70px 110px",
        background: "linear-gradient(160deg, #060a12 0%, #0b2540 60%, #1a0b2e 100%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 40, letterSpacing: 8, color: "#7dd3fc", fontWeight: 800 }}>YEAR ARC</div>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 900, marginTop: 24 }}>Mi {data.year}</div>
        <div style={{ display: "flex", fontSize: 40, color: "#cbd5e1", marginTop: 8 }}>{name}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 150, fontWeight: 900, lineHeight: 1 }}>{data.current !== null ? `${data.current}%` : "Día 1"}</div>
        <div style={{ display: "flex", fontSize: 38, color: "#cbd5e1", marginTop: 12 }}>de constancia esta semana</div>
      </div>

      <div style={{ display: "flex", width: CW, height: CH, position: "relative" }}>
        <svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`}>
          {[0, 50, 100].map((v) => (
            <line key={v} x1={0} x2={CW} y1={CH - (v / 100) * CH} y2={CH - (v / 100) * CH} stroke="rgba(148,163,184,0.25)" strokeWidth={2} />
          ))}
          {area ? <path d={area} fill="#38bdf8" fillOpacity={0.15} /> : null}
          {path ? <path d={path} fill="none" stroke="#38bdf8" strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {last && last.value !== null && n > 1 ? (
            <circle cx={(lastIdx / (n - 1)) * CW} cy={CH - (last.value / 100) * CH} r={16} fill="#38bdf8" stroke="#0b2540" strokeWidth={6} />
          ) : null}
        </svg>
      </div>

      <div style={{ display: "flex", gap: 32 }}>
        {[
          [String(data.perfectDays), "días perfectos"],
          [data.delta30 !== null ? `${data.delta30 >= 0 ? "+" : ""}${data.delta30}` : "—", "pts en 30 días"],
        ].map(([v, l]) => (
          <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 44px", borderRadius: 32, background: "rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", fontSize: 60, fontWeight: 800 }}>{v}</div>
            <div style={{ display: "flex", fontSize: 30, color: "#cbd5e1" }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", fontSize: 34, color: "#94a3b8" }}>Traza la tuya: winterarc-2026.vercel.app/w</div>
    </div>
  );
}

/** Imagen 1080×1920 (formato estado) con la línea de constancia del año. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!session.activeGroup) return NextResponse.json({ error: "no group" }, { status: 404 });

  let data: YearLine;
  try {
    data = await getYearLine(session.supabase, session.activeGroup.id, session.userId, session.today);
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
