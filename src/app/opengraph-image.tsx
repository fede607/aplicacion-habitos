import { ImageResponse } from "next/og";

export const alt = "Year Arc · Este año es para construirte";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Vista previa al compartir el enlace en WhatsApp, Instagram, etc. */
export default function OpengraphImage() {
  const values = [38, 46, 43, 55, 52, 61, 58, 67, 64, 72, 77, 74, 81, 86, 84, 91];
  const w = 460;
  const h = 260;
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * w).toFixed(1)} ${(h - (v / 100) * h).toFixed(1)}`).join(" ");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "70px 80px",
          background: "linear-gradient(135deg, #060a12 0%, #0b2540 60%, #1a0b2e 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 6, color: "#7dd3fc", fontWeight: 800 }}>YEAR ARC</div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 900, lineHeight: 1.05, marginTop: 24 }}>Este año es para construirte.</div>
          <div style={{ display: "flex", fontSize: 30, color: "#cbd5e1", marginTop: 28, lineHeight: 1.3 }}>Tus hábitos y tu constancia, en una línea que sube contigo. Gratis.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 900 }}>91%</div>
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            <path d={`${d} L${w} ${h} L0 ${h} Z`} fill="#38bdf8" fillOpacity={0.15} />
            <path d={d} fill="none" stroke="#38bdf8" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
