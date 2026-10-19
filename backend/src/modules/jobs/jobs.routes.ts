import crypto from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { env } from "@/config/env.js";
import { HttpError } from "@/lib/http-error.js";
import { ejecutarExpiryCheck } from "@/jobs/expiry-check.job.js";
import { ejecutarReorderCheck } from "@/jobs/reorder-check.job.js";

export const jobsRouter = Router();

function hash(valor: string) {
  return crypto.createHash("sha256").update(valor).digest();
}

/**
 * Autenticación para servicios externos (cron-job.org) que no tienen sesión
 * de usuario: comparan el header X-Cron-Secret contra CRON_SECRET. Se
 * comparan los hashes para que timingSafeEqual reciba largos iguales.
 */
function requireCronSecret(req: Request, _res: Response, next: NextFunction) {
  if (!env.CRON_SECRET) throw new HttpError(503, "Disparo externo deshabilitado (falta CRON_SECRET)");
  const recibido = req.header("x-cron-secret") ?? "";
  if (!crypto.timingSafeEqual(hash(recibido), hash(env.CRON_SECRET))) throw new HttpError(401, "No autorizado");
  next();
}

/**
 * Dispara la revisión diaria desde afuera, para que corra aunque Render haya
 * dormido el servicio (plan free) y node-cron no llegue a ejecutarse. Se
 * responde 202 enseguida y la revisión sigue en segundo plano, así el cron
 * externo no corta la llamada por timeout. La frecuencia del informe la
 * sigue decidiendo Configuración, así que el cron externo se programa todos
 * los días.
 */
jobsRouter.post("/revision-diaria", requireCronSecret, (_req, res) => {
  res.status(202).json({ aceptado: true });
  void ejecutarReorderCheck().then(ejecutarExpiryCheck);
});
