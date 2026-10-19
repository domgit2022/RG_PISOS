import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/lib/prisma.js";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";
import { HttpError } from "@/lib/http-error.js";

export const categoriesRouter = Router();

categoriesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const categorias = await prisma.categoria.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      include: { subcategorias: { where: { activo: true }, orderBy: { nombre: "asc" } } },
    });
    res.json(categorias.filter((c) => c.categoriaPadreId === null));
  })
);

const crearCategoriaSchema = z.object({
  nombre: z.string().min(1),
  categoriaPadreId: z.string().nullable().optional(),
});

categoriesRouter.get(
  "/planas",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.categoria.findMany({
        where: { activo: true },
        orderBy: { nombre: "asc" },
        select: { id: true, nombre: true, categoriaPadreId: true },
      })
    );
  })
);

categoriesRouter.post(
  "/",
  requireAuth,
  requirePermiso("productos.editar"),
  asyncHandler(async (req, res) => {
    const data = crearCategoriaSchema.parse(req.body);
    const categoria = await prisma.categoria.create({ data });
    res.status(201).json(categoria);
  })
);

const updateCategoriaSchema = z.object({
  nombre: z.string().min(1).optional(),
  categoriaPadreId: z.string().nullable().optional(),
  activo: z.boolean().optional(),
});

categoriesRouter.put(
  "/:id",
  requireAuth,
  requirePermiso("productos.editar"),
  asyncHandler(async (req, res) => {
    const data = updateCategoriaSchema.parse(req.body);
    if (data.categoriaPadreId === req.params.id) {
      throw new HttpError(400, "Una categoría no puede ser su propia subcategoría");
    }
    const categoria = await prisma.categoria.update({ where: { id: req.params.id }, data });
    res.json(categoria);
  })
);
