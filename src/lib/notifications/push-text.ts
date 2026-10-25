export type Pending = { pending: string[]; challenges: string[]; streak: number };

/** Texto del aviso según el momento del día (period_key termina en -am, -late o nada). */
export function pushReminderText(displayName: string, periodKey: string, p: Pending): { title: string; body: string } {
  const first = displayName.trim().split(/\s+/)[0] || "crack";
  const items = [...p.pending, ...p.challenges.map((c) => `reto «${c}»`)];
  const list = items.slice(0, 3).join(", ") + (items.length > 3 ? "…" : "");
  const n = items.length;
  if (periodKey.endsWith("-am")) {
    return { title: `☀️ Buenos días, ${first}`, body: `Hoy te toca: ${list}. ¡Un día más de tu Year Arc!` };
  }
  if (periodKey.endsWith("-late")) {
    return {
      title: p.streak > 0 ? `🌙 Última llamada: salva tu racha de ${p.streak} días` : `🌙 Última llamada, ${first}`,
      body: `Aún te ${n === 1 ? "falta" : "faltan"}: ${list}. Quedan pocas horas para cerrar el día.`,
    };
  }
  return {
    title: p.streak > 0 ? `🔥 ${first}, no pierdas tu racha de ${p.streak} días` : `⏰ ${first}, te ${n === 1 ? "queda" : "quedan"} ${n} por hacer`,
    body: `Pendientes: ${list}. Márcalos en 10 segundos.`,
  };
}
