/**
 * Composición (pura) de los emails de notificación. Sin IO: se testea en unitarios.
 */
import { formatMinutes } from "../dates";
import { esc, layout, statRow, statTable } from "../email/templates";
import type { OutgoingEmail } from "../email/mailer";

export type DailyReminderInput = {
  to: string;
  name: string;
  pendingHabits: string[];
  done: number;
  required: number;
  streak: number;
  siteUrl: string;
  unsubscribeUrl: string;
};

export function composeDailyReminder(i: DailyReminderInput): OutgoingEmail {
  const n = i.pendingHabits.length;
  const subject = `Te ${n === 1 ? "queda 1 hábito" : `quedan ${n} hábitos`} hoy${i.streak > 0 ? ` · 🔥 racha de ${i.streak}` : ""}`;
  const list = i.pendingHabits.map((h) => `<li style="margin:4px 0">${esc(h)}</li>`).join("");
  const streakLine =
    i.streak > 0
      ? `<p>Llevas <strong>🔥 ${i.streak} ${i.streak === 1 ? "día" : "días"}</strong> seguidos. No la rompas hoy.</p>`
      : `<p>Hoy es un buen día para empezar una racha.</p>`;
  return {
    to: i.to,
    subject,
    unsubscribeUrl: i.unsubscribeUrl,
    html: layout({
      preheader: `Llevas ${i.done}/${i.required} hábitos hoy.`,
      title: `${i.name}, ¿has completado tus hábitos de hoy?`,
      body: `<p>Llevas <strong>${i.done} de ${i.required}</strong> hábitos del día. Te ${n === 1 ? "falta" : "faltan"}:</p><ul style="padding-left:20px;margin:8px 0">${list}</ul>${streakLine}`,
      ctaText: "Marcar mis hábitos",
      ctaUrl: `${i.siteUrl}/today`,
      unsubscribeUrl: i.unsubscribeUrl,
    }),
    text: `${i.name}, llevas ${i.done} de ${i.required} hábitos hoy. Te faltan:\n${i.pendingHabits.map((h) => `- ${h}`).join("\n")}\n\n${i.streak > 0 ? `Racha actual: ${i.streak} días.\n\n` : ""}Márcalos en ${i.siteUrl}/today\n\nDarse de baja: ${i.unsubscribeUrl}`,
  };
}

export type WeeklySummaryInput = {
  to: string;
  name: string;
  groupName: string;
  week: { completed: number; required: number; percent: number | null };
  streak: { current: number; best: number };
  workouts: { count: number; minutes: number };
  weeklyTargets: { name: string; done: number; target: number }[];
  members: { name: string; weekPercent: number | null; streak: number; isMe: boolean }[];
  collective: { done: number; required: number };
  ranked: boolean;
  hiddenMembers: number;
  siteUrl: string;
  unsubscribeUrl: string;
};

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

export function composeWeeklySummary(i: WeeklySummaryInput): OutgoingEmail {
  const collectivePct = i.collective.required ? Math.round((i.collective.done / i.collective.required) * 100) : null;
  const mine = statTable([
    statRow("Hábitos esta semana", `${i.week.completed} / ${i.week.required} (${pct(i.week.percent)})`),
    statRow("Racha actual", `🔥 ${i.streak.current} días`),
    statRow("Mejor racha", `${i.streak.best} días`),
    statRow("Entrenamientos", `${i.workouts.count} · ${formatMinutes(i.workouts.minutes)}`),
    ...i.weeklyTargets.map((t) => statRow(t.name, `${t.done} / ${t.target}${t.done >= t.target ? " ✅" : ""}`)),
  ]);
  const memberRows = i.members
    .map(
      (m, idx) =>
        `<tr><td style="padding:6px 0">${i.ranked ? `${idx + 1}. ` : ""}${esc(m.name)}${m.isMe ? " (tú)" : ""}</td><td style="padding:6px 0;text-align:right">${esc(pct(m.weekPercent))}</td><td style="padding:6px 0 6px 12px;text-align:right;color:#c2410c">${m.streak > 0 ? `🔥${m.streak}` : "—"}</td></tr>`,
    )
    .join("");
  const group = `<h2 style="font-size:16px;margin:20px 0 4px">${esc(i.groupName)}</h2>
<p style="margin:0 0 8px;color:#5a6a82">Juntos habéis completado <strong style="color:#0b1220">${i.collective.done} de ${i.collective.required}</strong> hábitos (${pct(collectivePct)}).</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eef2f8;font-size:14px">${memberRows}</table>
${i.hiddenMembers > 0 ? `<p style="font-size:12px;color:#5a6a82">${i.hiddenMembers} ${i.hiddenMembers === 1 ? "miembro tiene" : "miembros tienen"} sus estadísticas en privado.</p>` : ""}`;

  return {
    to: i.to,
    subject: `Tu semana en el Winter Arc: ${pct(i.week.percent)} · 🔥 ${i.streak.current}`,
    unsubscribeUrl: i.unsubscribeUrl,
    html: layout({
      preheader: `Semana: ${i.week.completed}/${i.week.required} hábitos. Grupo: ${pct(collectivePct)}.`,
      title: `Resumen semanal de ${i.name}`,
      body: `${mine}${group}`,
      ctaText: "Ver mi progreso",
      ctaUrl: `${i.siteUrl}/dashboard`,
      unsubscribeUrl: i.unsubscribeUrl,
    }),
    text: [
      `Resumen semanal de ${i.name}`,
      `Hábitos: ${i.week.completed}/${i.week.required} (${pct(i.week.percent)})`,
      `Racha actual: ${i.streak.current} días · Mejor: ${i.streak.best}`,
      `Entrenamientos: ${i.workouts.count} (${formatMinutes(i.workouts.minutes)})`,
      ...i.weeklyTargets.map((t) => `${t.name}: ${t.done}/${t.target}`),
      "",
      `${i.groupName}: ${i.collective.done}/${i.collective.required} (${pct(collectivePct)})`,
      ...i.members.map((m, idx) => `${i.ranked ? `${idx + 1}. ` : "- "}${m.name}: ${pct(m.weekPercent)} · racha ${m.streak}`),
      "",
      `Ver progreso: ${i.siteUrl}/dashboard`,
      `Darse de baja: ${i.unsubscribeUrl}`,
    ].join("\n"),
  };
}
