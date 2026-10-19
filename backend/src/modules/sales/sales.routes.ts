import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";
import * as salesService from "./sales.service.js";

export const salesRouter = Router();

salesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await salesService.listVentas());
  })
);

const crearVentaSchema = z.object({
  clienteId: z.string().nullish(),
  listaPrecioId: z.string().min(1),
  medioPagoId: z.string().min(1),
  almacenId: z.string().min(1),
  descuento: z.number().min(0).optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1),
        cantidad: z.number().positive(),
      })
    )
    .min(1),
});

salesRouter.post(
  "/",
  requireAuth,
  requirePermiso("ventas.registrar"),
  asyncHandler(async (req, res) => {
    const data = crearVentaSchema.parse(req.body);
    const venta = await salesService.crearVenta(data, req.auth!.sub);
    res.status(201).json(venta);
  })
);

const anularVentaSchema = z.object({ motivo: z.string().min(3, "El motivo es obligatorio") });

salesRouter.post(
  "/:id/anular",
  requireAuth,
  requirePermiso("ventas.registrar"),
  asyncHandler(async (req, res) => {
    const { motivo } = anularVentaSchema.parse(req.body);
    const venta = await salesService.anularVenta(req.params.id, motivo, req.auth!.sub);
    res.json(venta);
  })
);
