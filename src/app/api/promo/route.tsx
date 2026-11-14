import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";

/** Carteles 1080×1920 para estados de WhatsApp / historias. ?v=1|2|3 */

const LINK = "winterarc-2026.vercel.app/w";
const INK = "#05070d";
const PAPER = "#f5f1e8";
const HOT = "linear-gradient(100deg, #ff7a18 0%, #ff3d77 55%, #9b5cff 100%)";

const fontFile = (name: string) => readFile(join(process.cwd(), "assets/fonts", name));
let fontsPromise: Promise<Buffer[]> | null = null;
/** Fuentes en memoria; si una lectura falla, se reintenta en la siguiente petición. */
function loadFonts() {
  fontsPromise ??= Promise.all([fontFile("anton-latin-400-normal.woff"), fontFile("inter-latin-500-normal.woff"), fontFile("inter-latin-700-normal.woff")]).catch((e) => {
    fontsPromise = null;
    throw e;
  });
  return fontsPromise;
}

const display = { fontFamily: "Anton", textTransform: "uppercase" as const, lineHeight: 0.95 };

function Arrow({ color, size = 56 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h16M13 5l7 7-7 7" />
    </svg>
  );
}

/** Cabecera común: marca a la izquierda, aviso de aforo a la derecha. */
function Top({ accent }: { accent: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", fontFamily: "Anton", fontSize: 54, letterSpacing: 6 }}>YEAR ARC</div>
      <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 700, letterSpacing: 3, color: accent }}>
        <div style={{ display: "flex", width: 18, height: 18, borderRadius: 9, background: accent, marginRight: 14 }} />
        ACCESO LIMITADO
      </div>
    </div>
  );
}

/** Pie común: botón, enlace y condición del aforo. */
function Bottom() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: PAPER, color: INK, padding: "38px 48px", borderRadius: 28 }}>
        <div style={{ display: "flex", ...display, fontSize: 72 }}>Coge tu plaza gratis</div>
        <Arrow color={INK} size={72} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 34 }}>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>{LINK}</div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 500, color: "#9aa3b2" }}>Al llenarse, se cierra</div>
      </div>
    </div>
  );
}

function Frame({ children, glow }: { children: React.ReactNode; glow: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "120px 80px 110px",
        background: INK,
        backgroundImage: glow,
        color: "#ffffff",
        fontFamily: "Inter",
      }}
    >
      {children}
    </div>
  );
}

/** 1 · El aforo: un 90 enorme y el plano de plazas con la tuya encendida. */
function Seats() {
  const cells = Array.from({ length: 90 }, (_, i) => i);
  const mine = 57;
  return (
    <Frame glow="radial-gradient(900px 700px at 85% 22%, rgba(255,61,119,0.28), transparent 70%)">
      <Top accent="#ff8a3d" />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: 640, lineHeight: 0.82, width: 640, backgroundImage: HOT, backgroundClip: "text", color: "transparent" }}>90</div>
        <div style={{ display: "flex", marginTop: 30 }}>
          <div style={{ display: "flex", ...display, fontSize: 104 }}>plazas.</div>
          <div style={{ display: "flex", ...display, fontSize: 104, marginLeft: 26, color: "#ff8a3d" }}>Ni una más.</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", width: 920, marginTop: 44 }}>
          {cells.map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                width: 49,
                height: 49,
                marginRight: 12,
                marginBottom: 12,
                borderRadius: 10,
                ...(i === mine ? { backgroundImage: HOT } : { border: "3px solid rgba(255,255,255,0.22)" }),
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 500, color: "#c8ced9", marginTop: 34, lineHeight: 1.3 }}>
          Una de esas es la tuya. Tus hábitos, tu entreno y tu año, día a día.
        </div>
      </div>
      <Bottom />
    </Frame>
  );
}

/** 2 · El año: 365 días pintados, como dentro de la app. */
function Year() {
  // Patrón fijo (sin azar): un año que empieza irregular y acaba constante.
  const days = Array.from({ length: 364 }, (_, i) => {
    const wobble = (i * 37 + (i % 7) * 11) % 100;
    const chance = 35 + (i / 364) * 60;
    return wobble < chance;
  });
  return (
    <Frame glow="radial-gradient(1000px 800px at 10% 55%, rgba(56,189,248,0.22), transparent 70%)">
      <Top accent="#7dd3fc" />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 5, color: "#7dd3fc" }}>SOLO 90 PLAZAS</div>
        <div style={{ display: "flex", ...display, fontSize: 170, marginTop: 52 }}>365 días.</div>
        <div style={{ display: "flex", ...display, fontSize: 170, color: "#7dd3fc" }}>Cero excusas.</div>
        <div style={{ display: "flex", flexWrap: "wrap", width: 936, marginTop: 52 }}>
          {days.map((on, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                width: 28,
                height: 28,
                marginRight: 8,
                marginBottom: 8,
                borderRadius: 7,
                background: on ? (i > 300 ? "#e0f2fe" : "#38bdf8") : "rgba(255,255,255,0.09)",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 500, color: "#c8ced9", marginTop: 30, lineHeight: 1.3 }}>
          Cada día que cumples, se pinta. Mira tu año llenarse.
        </div>
      </div>
      <Bottom />
    </Frame>
  );
}

/** 3 · El plan: la rutina del día tal cual la ves en la app. */
function Plan() {
  const rows = [
    ["Sentadilla", "4 × 8", "70 kg"],
    ["Press banca", "4 × 8", "55 kg"],
    ["Remo con barra", "3 × 10", "45 kg"],
    ["Plancha", "3 × 45 s", ""],
  ];
  return (
    <Frame glow="radial-gradient(900px 800px at 90% 60%, rgba(155,92,255,0.30), transparent 70%)">
      <Top accent="#c4a5ff" />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 5, color: "#c4a5ff" }}>1 MES DE PRO GRATIS · SOLO 90 PLAZAS</div>
        <div style={{ display: "flex", ...display, fontSize: 200, marginTop: 18 }}>Tu plan.</div>
        <div style={{ display: "flex", ...display, fontSize: 200, backgroundImage: HOT, backgroundClip: "text", color: "transparent" }}>A tu medida.</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 56, background: "#10141f", border: "3px solid rgba(255,255,255,0.14)", borderRadius: 36, padding: "40px 44px", transform: "rotate(-2deg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, fontWeight: 700, letterSpacing: 4, color: "#9aa3b2" }}>
            <div style={{ display: "flex" }}>HOY · FUERZA</div>
            <div style={{ display: "flex", color: "#c4a5ff" }}>2.450 KCAL</div>
          </div>
          {rows.map(([name, sets, load], i) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 26, paddingTop: 26, borderTop: i ? "2px solid rgba(255,255,255,0.10)" : "0" }}>
              <div style={{ display: "flex", fontSize: 50, fontWeight: 700 }}>{name}</div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", fontSize: 44, fontWeight: 500, color: "#c8ced9" }}>{sets}</div>
                {load ? <div style={{ display: "flex", fontSize: 44, fontWeight: 700, marginLeft: 28 }}>{load}</div> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Bottom />
    </Frame>
  );
}

const DESIGNS = { "1": Seats, "2": Year, "3": Plan } as const;

export async function GET(request: NextRequest) {
  const v = request.nextUrl.searchParams.get("v") ?? "1";
  // Sólo 3 diseños: cualquier otra cosa (o parámetros extra para saltarse la caché) se redirige al canónico.
  const known = Object.hasOwn(DESIGNS, v);
  if (!known || [...request.nextUrl.searchParams.keys()].some((k) => k !== "v")) {
    return NextResponse.redirect(new URL(`/api/promo?v=${known ? v : "1"}`, request.url), 308);
  }
  const Design = DESIGNS[v as keyof typeof DESIGNS];
  const [anton, inter500, inter700] = await loadFonts();
  return new ImageResponse(<Design />, {
    width: 1080,
    height: 1920,
    fonts: [
      { name: "Anton", data: anton, weight: 400, style: "normal" },
      { name: "Inter", data: inter500, weight: 500, style: "normal" },
      { name: "Inter", data: inter700, weight: 700, style: "normal" },
    ],
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
