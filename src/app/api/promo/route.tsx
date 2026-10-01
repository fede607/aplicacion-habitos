import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

/** Imágenes 1080×1920 para estados de WhatsApp / historias. ?v=1|2|3 */

const LINK = "winterarc-2026.vercel.app/w";

const DESIGNS = {
  "1": {
    kicker: "RETO DE 365 DÍAS",
    title: ["Este año", "es para", "construirte."],
    sub: "Tus hábitos, tu entreno y tu año pintado día a día. Gratis.",
    bg: "linear-gradient(160deg, #060a12 0%, #0b2540 55%, #3b1a0a 100%)",
  },
  "2": {
    kicker: "TU AÑO EN UNA LÍNEA",
    title: ["Mira cómo", "sube tu", "constancia."],
    sub: "Elige tus hábitos y cada día que cumples tu línea sube.",
    bg: "linear-gradient(160deg, #1a0633 0%, #3b0a4a 50%, #0b2540 100%)",
  },
  "3": {
    kicker: "1 MES PRO GRATIS",
    title: ["Tu plan de", "entreno a", "tu medida."],
    sub: "Rutina, series y calorías según tu cuerpo y objetivo.",
    bg: "linear-gradient(160deg, #04140d 0%, #0b3b2a 55%, #0b2540 100%)",
  },
} as const;

function Card({ d }: { d: (typeof DESIGNS)[keyof typeof DESIGNS] }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "150px 90px 130px",
        background: d.bg,
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 46, letterSpacing: 10, color: "#7dd3fc", fontWeight: 800 }}>YEAR ARC</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 40, letterSpacing: 6, color: "#fdba74", fontWeight: 800 }}>{d.kicker}</div>
        {d.title.map((line) => (
          <div key={line} style={{ display: "flex", fontSize: 128, fontWeight: 900, lineHeight: 1.05, marginTop: 10 }}>
            {line}
          </div>
        ))}
        <div style={{ display: "flex", fontSize: 50, color: "#cbd5e1", marginTop: 44, lineHeight: 1.3 }}>{d.sub}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            padding: "34px 60px",
            borderRadius: 999,
            background: "linear-gradient(90deg, #f97316, #ec4899, #8b5cf6)",
            fontSize: 52,
            fontWeight: 900,
          }}
        >
          Empieza gratis →
        </div>
        <div style={{ display: "flex", fontSize: 44, marginTop: 36, color: "#e2e8f0", fontWeight: 700 }}>{LINK}</div>
      </div>
    </div>
  );
}

export function GET(request: NextRequest) {
  const v = request.nextUrl.searchParams.get("v") ?? "1";
  const d = DESIGNS[(v in DESIGNS ? v : "1") as keyof typeof DESIGNS];
  return new ImageResponse(<Card d={d} />, {
    width: 1080,
    height: 1920,
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
