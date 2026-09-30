"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#060a12", color: "#e6edf7", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>Algo ha fallado</h1>
          <p style={{ color: "#8b9ab3" }}>Ha ocurrido un error inesperado. Inténtalo de nuevo.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 12, border: 0, background: "#7dd3fc", color: "#04121f", fontWeight: 600 }}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
