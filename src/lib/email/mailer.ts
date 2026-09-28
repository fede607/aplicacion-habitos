import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envío por SMTP (Gmail con contraseña de aplicación, Resend, Brevo, SES…).
 * Las credenciales viven sólo en variables de entorno del servidor.
 */
export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
};

let transporter: Transporter | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
      pool: true,
      maxConnections: 2,
      rateDelta: 1000,
      rateLimit: 5,
    });
  }
  return transporter;
}

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  if (!isEmailConfigured()) throw new Error("SMTP no configurado");
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    headers: email.unsubscribeUrl
      ? {
          "List-Unsubscribe": `<${email.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined,
  });
}
