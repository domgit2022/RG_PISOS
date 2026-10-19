import nodemailer from "nodemailer";
import { env } from "@/config/env.js";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

/** Cómo saldrían los mails con la configuración actual (para diagnóstico). */
export function metodoDeEnvio(): "relay" | "smtp" | "ninguno" {
  if (env.MAIL_RELAY_URL) return "relay";
  return transporter ? "smtp" : "ninguno";
}

export interface SendMailInput {
  to: string[];
  subject: string;
  text: string;
  html: string;
}

/**
 * Si no hay SMTP_HOST configurado en el entorno, el envío se omite con un
 * aviso en consola en vez de fallar, para no bloquear el resto del sistema
 * mientras no se cargan credenciales reales de correo.
 */
export async function sendMail({ to, subject, text, html }: SendMailInput) {
  if (to.length === 0) return;

  if (env.MAIL_RELAY_URL) {
    await sendMailRelay({ to, subject, text, html });
    return;
  }

  if (!transporter) {
    console.warn(`[mailer] SMTP no configurado, se omite el envío: "${subject}" -> ${to.join(", ")}`);
    return;
  }

  await transporter.sendMail({ from: env.SMTP_FROM, to, subject, text, html });
}

/**
 * Envío a través del Google Apps Script de la cuenta remitente (ver
 * MAIL_RELAY_URL): el script manda el mail con MailApp desde ese Gmail. Apps
 * Script siempre contesta 200, así que el resultado real viene en el JSON.
 */
async function sendMailRelay({ to, subject, text, html }: SendMailInput) {
  const nombre = env.SMTP_FROM.match(/^\s*(.*?)\s*</)?.[1] || "RG Pisos";
  const respuesta = await fetch(env.MAIL_RELAY_URL!, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clave: env.MAIL_RELAY_SECRET, to, subject, text, html, nombre }),
  });
  const cuerpo = await respuesta.text();
  let resultado: { ok?: boolean; error?: string } = {};
  try {
    resultado = JSON.parse(cuerpo);
  } catch {
    // Si Apps Script falla devuelve una página HTML, no JSON.
  }
  if (!respuesta.ok || !resultado.ok) {
    throw new Error(`[mailer] El script de envío rechazó el mail (${respuesta.status}): ${resultado.error ?? cuerpo.slice(0, 300)}`);
  }
}
