import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";
import * as suppliersService from "./suppliers.service.js";

export const suppliersRouter = Router();

suppliersRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await suppliersService.listSuppliers());
  })
);

const supplierSchema = z.object({
  nombre: z.string().min(1),
  cuit: z.string().nullish(),
  contactoNombre: z.string().nullish(),
  telefono: z.string().nullish(),
  email: z.string().email().nullish(),
  direccion: z.string().nullish(),
  condicionesPago: z.string().nullish(),
});

suppliersRouter.post(
  "/",
  requireAuth,
  requirePermiso("proveedores.gestionar"),
  asyncHandler(async (req, res) => {
    const data = supplierSchema.parse(req.body);
    res.status(201).json(await suppliersService.createSupplier(data));
  })
);

const updateSupplierSchema = supplierSchema.partial().extend({ activo: z.boolean().optional() });

suppliersRouter.put(
  "/:id",
  requireAuth,
  requirePermiso("proveedores.gestionar"),
  asyncHandler(async (req, res) => {
    const data = updateSupplierSchema.parse(req.body);
    res.json(await suppliersService.updateSupplier(req.params.id, data));
  })
);
