import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";
import { sendWorkbook } from "@/lib/excel.js";
import * as reportsService from "./reports.service.js";

export const reportsRouter = Router();

reportsRouter.get(
  "/stock-valorizado",
  requireAuth,
  requirePermiso("reportes.ver"),
  asyncHandler(async (_req, res) => {
    res.json(await reportsService.stockValorizado());
  })
);

reportsRouter.get(
  "/stock-valorizado/exportar",
  requireAuth,
  requirePermiso("datos.exportar"),
  asyncHandler(async (_req, res) => {
    const data = await reportsService.stockValorizado();
    await sendWorkbook(res, "stock-valorizado.xlsx", [
      {
        name: "Por categoría",
        columns: [
          { header: "Categoría", key: "categoria", width: 30 },
          { header: "Valor a costo", key: "valorCosto", width: 18 },
          { header: "Valor a venta", key: "valorVenta", width: 18 },
        ],
        rows: data.porCategoria,
      },
    ]);
  })
);

reportsRouter.get(
  "/productos-a-vencer",
  requireAuth,
  requirePermiso("reportes.ver"),
  asyncHandler(async (_req, res) => {
    res.json(await reportsService.productosAVencer());
  })
);

reportsRouter.get(
  "/productos-a-vencer/exportar",
  requireAuth,
  requirePermiso("datos.exportar"),
  asyncHandler(async (_req, res) => {
    const rows = await reportsService.productosAVencer();
    await sendWorkbook(res, "productos-a-vencer.xlsx", [
      {
        name: "Productos a vencer",
        columns: [
          { header: "Producto", key: "producto", width: 30 },
          { header: "Material", key: "sku", width: 16 },
          { header: "Lote", key: "numeroLote", width: 16 },
          { header: "Vencimiento", key: "fechaVencimiento", width: 16 },
          { header: "Días restantes", key: "diasRestantes", width: 14 },
          { header: "Cantidad", key: "cantidad", width: 12 },
          { header: "Valor en riesgo", key: "valorEnRiesgo", width: 16 },
        ],
        rows,
      },
    ]);
  })
);

reportsRouter.get(
  "/stock-bajo",
  requireAuth,
  requirePermiso("reportes.ver"),
  asyncHandler(async (_req, res) => {
    res.json(await reportsService.productosStockBajo());
  })
);

const periodoQuerySchema = z.object({ desde: z.string(), hasta: z.string() });

reportsRouter.get(
  "/ventas",
  requireAuth,
  requirePermiso("reportes.ver"),
  asyncHandler(async (req, res) => {
    const { desde, hasta } = periodoQuerySchema.parse(req.query);
    res.json(await reportsService.ventasPorPeriodo(new Date(desde), new Date(hasta)));
  })
);

reportsRouter.get(
  "/mermas-ajustes",
  requireAuth,
  requirePermiso("reportes.ver"),
  asyncHandler(async (req, res) => {
    const { desde, hasta } = periodoQuerySchema.parse(req.query);
    res.json(await reportsService.mermasYAjustes(new Date(desde), new Date(hasta)));
  })
);
