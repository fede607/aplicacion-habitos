import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getSession, type GroupSession } from "@/lib/data/session";
import { getPersonalStats } from "@/lib/data/personal-stats";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Llama dibujada con SVG (sin depender de fuentes de emoji). */
function Flame({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="f" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#c2410c" />
          <stop offset="0.55" stopColor="#f97316" />
          <stop offset="1" stopColor="#fde047" />
        </linearGradient>
      </defs>
      <path
        fill="url(#f)"
        d="M12 23c4.4 0 8-3.2 8-7.8 0-3.1-1.6-5.6-3.4-7.6-.4-.4-1 0-.9.5.2 1.3-.1 2.6-1 3.4-.2-3.3-2-6.4-4.8-8.9-.4-.3-1 0-.9.5.3 2.5-.8 4.4-2.3 6.1C5.3 11 4 12.9 4 15.2 4 19.8 7.6 23 12 23Z"
      />
    </svg>
  );
}

type CardProps = {
  name: string;
  headline: string;
  sub: string;
  percent: number;
  best: number;
};

function StreakCard({ name, headline, sub, percent, best }: CardProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "140px 80px 120px",
        background:
          "linear-gradient(160deg, #060a12 0%, #0b2540 55%, #3b1a0a 100%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: 44,
            letterSpacing: 8,
            color: "#7dd3fc",
            fontWeight: 700,
          }}
        >
          YEAR ARC
        </div>
        <div style={{ fontSize: 40, marginTop: 16, color: "#cbd5e1" }}>
          {name}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Flame size={360} />
        <div
          style={{
            fontSize: 200,
            fontWeight: 900,
            lineHeight: 1,
            marginTop: 20,
          }}
        >
          {headline}
        </div>
        <div style={{ fontSize: 56, marginTop: 24, color: "#fdba74" }}>
          {sub}
        </div>
      </div>

      <div style={{ display: "flex", gap: 40 }}>
        {[
          [`${percent}%`, "cumplimiento"],
          [`${best}`, "mejor racha"],
        ].map(([v, l]) => (
          <div
            key={l}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "28px 48px",
              borderRadius: 32,
              background: "rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ fontSize: 72, fontWeight: 800 }}>{v}</div>
            <div style={{ fontSize: 32, color: "#cbd5e1" }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 36, color: "#94a3b8" }}>
        ¿Te atreves? winterarc-2026.vercel.app
      </div>
    </div>
  );
}

/** Imagen 1080×1920 (formato historia) con la racha del usuario, para compartir. */
export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!session.activeGroup)
    return NextResponse.json({ error: "no group" }, { status: 404 });

  let stats: Awaited<ReturnType<typeof getPersonalStats>>;
  try {
    stats = await getPersonalStats(session as GroupSession);
  } catch (e) {
    logServerError("share:streak", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  const streak = stats.streaks.current;
  const props: CardProps = {
    name: session.profile.display_name.slice(0, 24),
    headline:
      streak > 0 ? `${streak} ${streak === 1 ? "día" : "días"}` : "Día 1",
    sub: streak > 0 ? "de racha sin fallar" : "empieza mi racha",
    percent: stats.arc.percent ?? 0,
    best: stats.streaks.best,
  };
  return new ImageResponse(<StreakCard {...props} />, {
    width: 1080,
    height: 1920,
    headers: { "Cache-Control": "private, no-store" },
  });
}
