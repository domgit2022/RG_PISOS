import cron from "node-cron";
import { env } from "@/config/env.js";
import { verificarVencimientosProximos } from "@/modules/alerts/alerts.service.js";

export async function ejecutarExpiryCheck() {
  try {
    const resultado = await verificarVencimientosProximos();
    console.log(
      `[expiry-check] productos revisados: ${resultado.productosRevisados}, lotes a vencer: ${resultado.lotesAVencer}, productos con stock bajo: ${resultado.productosStockBajo}, mail enviado: ${resultado.enviado}`
    );
  } catch (error) {
    console.error("[expiry-check] error al verificar vencimientos próximos", error);
  }
}

let diaUltimaRevisionPorIngreso: string | null = null;

/**
 * Dispara la revisión con el primer inicio de sesión del día, para que el
 * informe salga aunque Render haya dormido el servicio a la hora del cron.
 * Se corre en segundo plano (no demora el login) y una sola vez por día por
 * proceso; que el mail no se duplique lo garantiza verificarVencimientosProximos.
 */
export function revisarAlIngresar() {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: env.APP_TIMEZONE }).format(new Date());
  if (diaUltimaRevisionPorIngreso === hoy) return;
  diaUltimaRevisionPorIngreso = hoy;
  void ejecutarExpiryCheck();
}

export function startExpiryCheckJob() {
  cron.schedule(env.EXPIRY_CHECK_CRON, ejecutarExpiryCheck, { timezone: env.APP_TIMEZONE });
}
