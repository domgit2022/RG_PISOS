import { Router } from "express";
import { prisma } from "@/lib/prisma.js";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth } from "@/middleware/auth.js";
import { z } from "zod";
import { listarLotesProximosAVencer, diasRestantesHasta } from "@/lib/vencimientos.js";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/resumen",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const [productos, { lotes: lotesPorVencer }] = await Promise.all([
      prisma.producto.findMany({
        where: { activo: true },
        select: { puntoReposicion: true, costoPromedio: true, lotes: { select: { cantidadActual: true } } },
      }),
      listarLotesProximosAVencer(),
    ]);

    let valorInventario = 0;
    let productosAReponer = 0;
    for (const producto of productos) {
      const stockActual = producto.lotes.reduce((acc, l) => acc + Number(l.cantidadActual), 0);
      valorInventario += stockActual * Number(producto.costoPromedio);
      if (stockActual <= Number(producto.puntoReposicion)) productosAReponer += 1;
    }

    res.json({
      valorInventario,
      productosAReponer,
      lotesPorVencer: lotesPorVencer.length,
      totalProductosActivos: productos.length,
    });
  })
);

/**
 * Detalle resumido de cada tarjeta del panel, con el mismo criterio que los
 * números de /resumen para que la lista coincida siempre con el contador.
 */
dashboardRouter.get(
  "/detalle/:tipo",
  requireAuth,
  asyncHandler(async (req, res) => {
    const tipo = z.enum(["reponer", "vencer", "activos"]).parse(req.params.tipo);

    if (tipo === "vencer") {
      const { lotes } = await listarLotesProximosAVencer();
      res.json(
        lotes.map((l) => ({
          loteId: l.loteId,
          productoId: l.producto.id,
          nombre: l.producto.nombre,
          sku: l.producto.sku,
          numeroLote: l.numeroLote,
          fechaVencimiento: l.fechaVencimiento,
          diasRestantes: diasRestantesHasta(l.fechaVencimiento),
          cantidad: l.cantidad,
          stockActual: l.stockActual,
        }))
      );
      return;
    }

    const productos = await prisma.producto.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        sku: true,
        stockMinimo: true,
        puntoReposicion: true,
        categoria: { select: { nombre: true } },
        unidadMedida: { select: { codigo: true } },
        proveedorPrincipal: { select: { nombre: true } },
        lotes: { select: { cantidadActual: true } },
      },
    });

    const filas = productos.map((p) => {
      const stockActual = p.lotes.reduce((acc, l) => acc + Number(l.cantidadActual), 0);
      return {
        productoId: p.id,
        nombre: p.nombre,
        sku: p.sku,
        categoria: p.categoria?.nombre ?? null,
        unidad: p.unidadMedida.codigo,
        proveedor: p.proveedorPrincipal?.nombre ?? null,
        stockActual,
        stockMinimo: Number(p.stockMinimo),
        puntoReposicion: Number(p.puntoReposicion),
        aReponer: stockActual <= Number(p.puntoReposicion),
      };
    });

    res.json(tipo === "reponer" ? filas.filter((f) => f.aReponer) : filas);
  })
);
