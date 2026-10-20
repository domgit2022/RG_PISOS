import "dotenv/config";
import path from "node:path";
import { z } from "zod";
import { zBooleanFlexible } from "@/lib/zod-helpers.js";

export function parseCorsOrigins(rawValue?: string): string[] {
  const defaults = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
  ];

  const values = (rawValue ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return [...new Set([...defaults, ...values])];
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:5173, http://localhost:5174, http://127.0.0.1:5173, http://localhost:3000, https://rg-pisos-frontend.onrender.com"),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("8h"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: zBooleanFlexible.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("RG Pisos <no-reply@rgpisos.local>"),
  // Google Apps Script publicado como aplicación web en la cuenta de Gmail
  // remitente. Si está definido, los mails salen por ahí (HTTPS) en vez de
  // SMTP: Render (plan free) bloquea las conexiones salientes a 25/465/587.
  MAIL_RELAY_URL: z.string().url().optional(),
  MAIL_RELAY_SECRET: z.string().optional(),
  REORDER_CHECK_CRON: z.string().default("0 */6 * * *"),
  EXPIRY_CHECK_CRON: z.string().default("0 8 * * *"),
  // Zona horaria en la que se interpretan los cron y se cuentan los días
  // calendario entre informes (el servidor en Render corre en UTC).
  APP_TIMEZONE: z.string().default("America/Argentina/Buenos_Aires"),
  // Clave compartida con el cron externo (cron-job.org) que dispara la
  // revisión diaria vía POST /api/jobs/revision-diaria. Sin ella, el
  // endpoint queda deshabilitado.
  CRON_SECRET: z.string().min(16).optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("branding"),
  // Servidor propio (sin Supabase): carpeta donde se guardan logo y fotos.
  UPLOADS_DIR: z.string().default(path.resolve(process.cwd(), "uploads")),
  // Si existe, el backend sirve también la web ya compilada (npm run build
  // en frontend/), así todo el sistema queda en un solo puerto.
  FRONTEND_DIST_DIR: z.string().default(path.resolve(process.cwd(), "../frontend/dist")),
});

const parsedEnv = envSchema.parse(process.env);

/**
 * Si no se define SUPABASE_URL a mano, se deriva del propio DATABASE_URL
 * (que ya trae la referencia del proyecto: postgres.<ref>@...supabase.com),
 * para no pedirle al usuario un dato que ya tenemos.
 */
function derivarSupabaseUrl(): string | undefined {
  // Si la cargan a mano suele venir copiada del dashboard con "/rest/v1/"
  // al final; el cliente de Supabase necesita solo el origen.
  if (parsedEnv.SUPABASE_URL) {
    try {
      return new URL(parsedEnv.SUPABASE_URL.trim()).origin;
    } catch {
      return parsedEnv.SUPABASE_URL.trim();
    }
  }
  const match = parsedEnv.DATABASE_URL.match(/postgres\.([a-z0-9]+):/i);
  return match ? `https://${match[1]}.supabase.co` : undefined;
}

export const corsOrigins = parseCorsOrigins(parsedEnv.CORS_ORIGIN);
export const env = { ...parsedEnv, SUPABASE_URL: derivarSupabaseUrl() };
