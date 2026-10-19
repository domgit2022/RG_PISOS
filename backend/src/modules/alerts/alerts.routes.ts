import { Router } from "express";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";
import * as alertsService from "./alerts.service.js";

export const alertsRouter = Router();

alertsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await alertsService.listAlerts());
  })
);

alertsRouter.post(
  "/verificar-stock-bajo",
  requireAuth,
  requirePermiso("stock.registrar_movimiento"),
  asyncHandler(async (_req, res) => {
    res.json(await alertsService.verificarPuntosDeReposicion());
  })
);

alertsRouter.post(
  "/verificar-vencimientos",
  requireAuth,
  requirePermiso("stock.registrar_movimiento"),
  asyncHandler(async (_req, res) => {
    res.json(await alertsService.verificarVencimientosProximos());
  })
);

// Envío manual del informe (vencimientos + stock bajo) a los destinatarios
// configurados, en cualquier momento. No cambia la fecha del último envío
// automático.
alertsRouter.post(
  "/enviar-informe",
  requireAuth,
  requirePermiso("reportes.ver", "configuracion.gestionar"),
  asyncHandler(async (_req, res) => {
    res.json(await alertsService.enviarInformePrueba());
  })
);
