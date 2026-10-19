import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/lib/prisma.js";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";

/** Catálogos auxiliares de solo lectura usados por formularios del frontend. */
export const catalogRouter = Router();

const crearAlmacenSchema = z.object({
  nombre: z.string().min(1).max(120),
  direccion: z.string().trim().max(200).nullish(),
  esPrincipal: z.boolean().default(false),
});

const crearUbicacionSchema = z.object({
  almacenId: z.string().min(1),
  nombre: z.string().min(1).max(120),
  ubicacionPadreId: z.string().nullish(),
});

catalogRouter.get(
  "/unidades-medida",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await prisma.unidadMedida.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }));
  })
);

catalogRouter.get(
  "/medios-pago",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await prisma.medioPago.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }));
  })
);

catalogRouter.get(
  "/almacenes",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.almacen.findMany({
        where: { activo: true },
        orderBy: { nombre: "asc" },
        include: { ubicaciones: { where: { activo: true }, orderBy: { nombre: "asc" } } },
      })
    );
  })
);

catalogRouter.post(
  "/almacenes",
  requireAuth,
  requirePermiso("productos.editar"),
  asyncHandler(async (req, res) => {
    const data = crearAlmacenSchema.parse(req.body);
    const almacen = await prisma.almacen.create({
      data: {
        ...data,
        ubicaciones: {
          create: [
            { nombre: "General" },
            { nombre: "Recepción" },
            { nombre: "Picking" },
          ],
        },
      },
      include: { ubicaciones: { where: { activo: true }, orderBy: { nombre: "asc" } } },
    });
    res.status(201).json(almacen);
  })
);

catalogRouter.post(
  "/ubicaciones",
  requireAuth,
  requirePermiso("productos.editar"),
  asyncHandler(async (req, res) => {
    const data = crearUbicacionSchema.parse(req.body);

    if (data.ubicacionPadreId) {
      const padre = await prisma.ubicacion.findUnique({ where: { id: data.ubicacionPadreId }, select: { almacenId: true } });
      if (!padre || padre.almacenId !== data.almacenId) {
        throw new Error("La ubicación padre debe pertenecer al mismo almacén");
      }
    }

    const ubicacion = await prisma.ubicacion.create({
      data: {
        almacenId: data.almacenId,
        nombre: data.nombre,
        ubicacionPadreId: data.ubicacionPadreId ?? null,
      },
    });

    res.status(201).json(ubicacion);
  })
);

catalogRouter.get(
  "/listas-precio",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await prisma.listaPrecio.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }));
  })
);
