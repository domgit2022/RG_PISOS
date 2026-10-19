import type { Prisma } from "../../generated/prisma/index.js";
import { prisma } from "@/lib/prisma.js";
import { HttpError } from "@/lib/http-error.js";

type Db = typeof prisma | Prisma.TransactionClient;

async function stockTotalProducto(productoId: string, tx: Db) {
  const lotes = await tx.lote.findMany({ where: { productoId }, select: { cantidadActual: true } });
  return lotes.reduce((acc, l) => acc + Number(l.cantidadActual), 0);
}

export interface VentaItemInput {
  productoId: string;
  cantidad: number;
}

export interface CreateVentaInput {
  clienteId?: string | null;
  listaPrecioId: string;
  medioPagoId: string;
  almacenId: string;
  descuento?: number;
  items: VentaItemInput[];
}

export async function crearVenta(input: CreateVentaInput, usuarioId: string) {
  if (input.items.length === 0) throw new HttpError(400, "La venta debe tener al menos un ítem");

  return prisma.$transaction(async (tx) => {
    let subtotal = 0;
    const detalles: { productoId: string; cantidad: number; precioUnitario: number; subtotal: number }[] = [];

    for (const item of input.items) {
      const precio = await tx.precioProducto.findFirst({
        where: { productoId: item.productoId, listaPrecioId: input.listaPrecioId, vigenteHasta: null, activo: true },
      });
      if (!precio) {
        throw new HttpError(400, `El producto ${item.productoId} no tiene precio vigente en la lista seleccionada`);
      }
      const precioUnitario = Number(precio.precio);
      const importe = precioUnitario * item.cantidad;
      subtotal += importe;
      detalles.push({ productoId: item.productoId, cantidad: item.cantidad, precioUnitario, subtotal: importe });
    }

    const descuento = input.descuento ?? 0;
    const total = subtotal - descuento;

    const venta = await tx.venta.create({
      data: {
        usuarioId,
        clienteId: input.clienteId,
        listaPrecioId: input.listaPrecioId,
        medioPagoId: input.medioPagoId,
        subtotal,
        descuento,
        total,
        detalles: { create: detalles },
      },
      include: { detalles: true },
    });

    for (const item of input.items) {
      let restante = item.cantidad;

      const lotesDisponibles = await tx.lote.findMany({
        where: { productoId: item.productoId, almacenId: input.almacenId, cantidadActual: { gt: 0 } },
        orderBy: [{ fechaVencimiento: { sort: "asc", nulls: "last" } }, { fechaIngreso: "asc" }],
      });

      const stockDisponible = lotesDisponibles.reduce((acc, l) => acc + Number(l.cantidadActual), 0);
      if (stockDisponible < item.cantidad) {
        throw new HttpError(400, `Stock insuficiente para el producto ${item.productoId} (disponible: ${stockDisponible})`);
      }

      for (const lote of lotesDisponibles) {
        if (restante <= 0) break;
        const consumir = Math.min(restante, Number(lote.cantidadActual));
        await tx.lote.update({ where: { id: lote.id }, data: { cantidadActual: { decrement: consumir } } });
        restante -= consumir;

        const stockResultante = (await stockTotalProducto(item.productoId, tx)) - consumir;
        await tx.movimientoStock.create({
          data: {
            productoId: item.productoId,
            loteId: lote.id,
            almacenId: input.almacenId,
            tipo: "EGRESO_VENTA",
            cantidad: -consumir,
            stockResultante,
            usuarioId,
            ventaId: venta.id,
          },
        });
      }
    }

    return venta;
  });
}

export async function anularVenta(id: string, motivo: string, usuarioId: string) {
  const venta = await prisma.venta.findUnique({ where: { id } });
  if (!venta) throw new HttpError(404, "Venta no encontrada");
  if (venta.estado === "ANULADA") throw new HttpError(400, "La venta ya está anulada");

  return prisma.$transaction(async (tx) => {
    const movimientos = await tx.movimientoStock.findMany({ where: { ventaId: id, tipo: "EGRESO_VENTA" } });

    for (const movimiento of movimientos) {
      const cantidadDevuelta = Math.abs(Number(movimiento.cantidad));
      await tx.lote.update({
        where: { id: movimiento.loteId },
        data: { cantidadActual: { increment: cantidadDevuelta } },
      });
      const stockResultante = await stockTotalProducto(movimiento.productoId, tx);
      await tx.movimientoStock.create({
        data: {
          productoId: movimiento.productoId,
          loteId: movimiento.loteId,
          almacenId: movimiento.almacenId,
          tipo: "DEVOLUCION_CLIENTE",
          cantidad: cantidadDevuelta,
          stockResultante,
          usuarioId,
          motivo: `Anulación de venta: ${motivo}`,
          ventaId: id,
        },
      });
    }

    return tx.venta.update({ where: { id }, data: { estado: "ANULADA", motivoAnulacion: motivo } });
  });
}

export async function listVentas() {
  return prisma.venta.findMany({
    orderBy: { fecha: "desc" },
    take: 200,
    include: {
      cliente: { select: { nombre: true } },
      usuario: { select: { nombreCompleto: true } },
      listaPrecio: { select: { nombre: true } },
      medioPago: { select: { nombre: true } },
      detalles: { include: { producto: { select: { nombre: true, sku: true } } } },
    },
  });
}
