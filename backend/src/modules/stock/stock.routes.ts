import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";
import { zBooleanFlexible } from "@/lib/zod-helpers.js";
import * as stockService from "./stock.service.js";

export const stockRouter = Router();

const listLotesQuerySchema = z.object({
  productoId: z.string().optional(),
  soloVencidos: zBooleanFlexible.optional(),
  soloPorVencer: zBooleanFlexible.optional(),
  diasPorVencer: z.coerce.number().int().min(1).optional(),
});

stockRouter.get(
  "/lotes",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = listLotesQuerySchema.parse(req.query);
    res.json(await stockService.listLotes(query));
  })
);

stockRouter.get(
  "/resumen",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await stockService.resumenStock());
  })
);

stockRouter.get(
  "/lotes-conocidos",
  requireAuth,
  asyncHandler(async (req, res) => {
    const productoId = z.string().min(1).parse(req.query.productoId);
    res.json(await stockService.listarLotesConocidos(productoId));
  })
);

stockRouter.get(
  "/movimientos",
  requireAuth,
  asyncHandler(async (req, res) => {
    const productoId = z.string().min(1).parse(req.query.productoId);
    res.json(await stockService.listMovimientos(productoId));
  })
);

const ingresoSchema = z.object({
  productoId: z.string().min(1),
  almacenId: z.string().min(1, "El almacén es obligatorio"),
  ubicacionId: z.string().nullish(),
  cantidad: z.number().positive(),
  costoUnitario: z.number().min(0),
  numeroLote: z.string().nullish(),
  fechaVencimiento: z.string().nullish(),
  proveedorId: z.string().nullish(),
});

stockRouter.post(
  "/ingreso",
  requireAuth,
  requirePermiso("stock.registrar_movimiento"),
  asyncHandler(async (req, res) => {
    const data = ingresoSchema.parse(req.body);
    const lote = await stockService.registrarIngreso(data, req.auth!.sub);
    res.status(201).json(lote);
  })
);

const ajusteSchema = z.object({
  loteId: z.string().min(1),
  tipo: z.enum(["AJUSTE", "MERMA"]),
  cantidad: z.number(),
  motivo: z.string().min(3, "El motivo es obligatorio"),
});

stockRouter.post(
  "/movimiento",
  requireAuth,
  requirePermiso("stock.registrar_movimiento"),
  asyncHandler(async (req, res) => {
    const data = ajusteSchema.parse(req.body);
    const movimiento = await stockService.registrarAjusteOMerma(data, req.auth!.sub);
    res.status(201).json(movimiento);
  })
);
