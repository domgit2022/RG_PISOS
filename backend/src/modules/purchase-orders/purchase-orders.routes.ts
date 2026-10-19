import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";
import * as purchaseOrdersService from "./purchase-orders.service.js";

export const purchaseOrdersRouter = Router();

purchaseOrdersRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await purchaseOrdersService.listOrdenesCompra());
  })
);

purchaseOrdersRouter.get(
  "/sugeridas",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await purchaseOrdersService.listaReposicionPorProveedor());
  })
);

const crearOrdenSchema = z.object({
  proveedorId: z.string().min(1),
  fechaEntregaEstimada: z.string().nullish(),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1),
        cantidadPedida: z.number().positive(),
        costoUnitarioPactado: z.number().min(0),
      })
    )
    .min(1),
});

purchaseOrdersRouter.post(
  "/",
  requireAuth,
  requirePermiso("proveedores.gestionar"),
  asyncHandler(async (req, res) => {
    const data = crearOrdenSchema.parse(req.body);
    res.status(201).json(await purchaseOrdersService.crearOrdenCompra(data, req.auth!.sub));
  })
);

const recibirSchema = z.object({
  items: z
    .array(
      z.object({
        detalleId: z.string().min(1),
        cantidadRecibida: z.number().positive(),
        almacenId: z.string().min(1, "El almacén es obligatorio"),
        numeroLote: z.string().nullish(),
        fechaVencimiento: z.string().nullish(),
      })
    )
    .min(1),
});

purchaseOrdersRouter.post(
  "/:id/recibir",
  requireAuth,
  requirePermiso("stock.registrar_movimiento"),
  asyncHandler(async (req, res) => {
    const { items } = recibirSchema.parse(req.body);
    res.json(await purchaseOrdersService.recibirOrdenCompra(req.params.id, items, req.auth!.sub));
  })
);

purchaseOrdersRouter.post(
  "/:id/cancelar",
  requireAuth,
  requirePermiso("proveedores.gestionar"),
  asyncHandler(async (req, res) => {
    res.json(await purchaseOrdersService.cancelarOrdenCompra(req.params.id));
  })
);
