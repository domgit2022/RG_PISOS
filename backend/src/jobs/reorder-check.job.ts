import cron from "node-cron";
import { env } from "@/config/env.js";
import { verificarPuntosDeReposicion } from "@/modules/alerts/alerts.service.js";

export async function ejecutarReorderCheck() {
  try {
    const resultado = await verificarPuntosDeReposicion();
    console.log(
      `[reorder-check] productos revisados: ${resultado.productosRevisados}, alertas creadas: ${resultado.alertasCreadas}, resueltas: ${resultado.alertasResueltas}`
    );
  } catch (error) {
    console.error("[reorder-check] error al verificar puntos de reposición", error);
  }
}

export function startReorderCheckJob() {
  cron.schedule(env.REORDER_CHECK_CRON, ejecutarReorderCheck, { timezone: env.APP_TIMEZONE });
}
