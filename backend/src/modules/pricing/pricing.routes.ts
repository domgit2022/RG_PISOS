import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";
import { ocultarCostoSiCorresponde } from "@/lib/visibility.js";
import * as pricingService from "./pricing.service.js";

export const pricingRouter = Router();

pricingRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const listaPrecioId = z.string().min(1).parse(req.query.listaPrecioId);
    const items = await pricingService.listPrecios(listaPrecioId);
    res.json(ocultarCostoSiCorresponde(items, req.auth!.permisos));
  })
);

pricingRouter.get(
  "/historial",
  requireAuth,
  asyncHandler(async (req, res) => {
    const productoId = z.string().min(1).parse(req.query.productoId);
    const listaPrecioId = z.string().min(1).parse(req.query.listaPrecioId);
    res.json(await pricingService.listHistorialPrecios(productoId, listaPrecioId));
  })
);

const setPrecioSchema = z.object({
  productoId: z.string().min(1),
  listaPrecioId: z.string().min(1),
  precio: z.number().positive(),
  margenPorcentaje: z.number().nullish(),
});

pricingRouter.put(
  "/",
  requireAuth,
  requirePermiso("precios.editar"),
  asyncHandler(async (req, res) => {
    const data = setPrecioSchema.parse(req.body);
    res.json(await pricingService.setPrecio(data));
  })
);
