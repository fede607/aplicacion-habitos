/**
 * Plantillas de email (HTML con estilos en línea + texto plano).
 * TODO contenido de usuario pasa por `esc` para evitar inyección de HTML.
 */
export function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Layout = { preheader: string; title: string; body: string; ctaText: string; ctaUrl: string; unsubscribeUrl?: string };

export function layout({ preheader, title, body, ctaText, ctaUrl, unsubscribeUrl }: Layout): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b1220">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dde4ee;border-radius:20px">
<tr><td style="padding:24px 24px 8px"><div style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#0369a1;text-transform:uppercase">❄️ Winter Arc</div>
<h1 style="margin:8px 0 0;font-size:22px;line-height:1.3">${esc(title)}</h1></td></tr>
<tr><td style="padding:8px 24px 8px;font-size:15px;line-height:1.55">${body}</td></tr>
<tr><td style="padding:12px 24px 28px"><a href="${esc(ctaUrl)}" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px">${esc(ctaText)}</a></td></tr>
</table>
${unsubscribeUrl ? `<p style="font-size:12px;color:#5a6a82;margin:16px 0 0">¿No quieres más correos? <a href="${esc(unsubscribeUrl)}" style="color:#5a6a82">Darse de baja</a> · También puedes cambiarlo en Ajustes.</p>` : ""}
</td></tr></table></body></html>`;
}

export function statRow(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;color:#5a6a82">${esc(label)}</td><td style="padding:6px 0;text-align:right;font-weight:700">${esc(value)}</td></tr>`;
}

export function statTable(rows: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;border-top:1px solid #eef2f8">${rows.join("")}</table>`;
}

export function verificationEmail(input: { name: string; url: string }) {
  const title = "Confirma tu email de notificaciones";
  return {
    subject: "Confirma tu email · Winter Arc",
    html: layout({
      preheader: "Confirma que este correo es tuyo para recibir avisos del Winter Arc.",
      title,
      body: `<p>Hola ${esc(input.name)}, has pedido recibir las notificaciones del Winter Arc en este correo.</p><p>Si no has sido tú, ignora este mensaje: no te enviaremos nada.</p><p style="color:#5a6a82;font-size:13px">El enlace caduca en 24 horas.</p>`,
      ctaText: "Confirmar email",
      ctaUrl: input.url,
    }),
    text: `Hola ${input.name}, confirma tu email de notificaciones del Winter Arc: ${input.url}\n\nSi no has sido tú, ignora este mensaje. El enlace caduca en 24 horas.`,
  };
}
