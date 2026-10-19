import { prisma } from "@/lib/prisma.js";
import { HttpError } from "@/lib/http-error.js";
import * as stockService from "@/modules/stock/stock.service.js";

export interface CreatePurchaseOrderInput {
  proveedorId: string;
  fechaEntregaEstimada?: string | null;
  items: { productoId: string; cantidadPedida: number; costoUnitarioPactado: number }[];
}

export async function crearOrdenCompra(input: CreatePurchaseOrderInput, usuarioId: string) {
  if (input.items.length === 0) throw new HttpError(400, "La orden debe tener al menos un ítem");

  return prisma.ordenCompra.create({
    data: {
      proveedorId: input.proveedorId,
      usuarioId,
      fechaEntregaEstimada: input.fechaEntregaEstimada ? new Date(input.fechaEntregaEstimada) : null,
      detalles: { create: input.items },
    },
    include: { detalles: true, proveedor: { select: { nombre: true } } },
  });
}

export async function listOrdenesCompra() {
  return prisma.ordenCompra.findMany({
    orderBy: { fecha: "desc" },
    include: {
      proveedor: { select: { nombre: true } },
      detalles: { include: { producto: { select: { nombre: true, sku: true } } } },
    },
  });
}

export interface RecibirItemInput {
  detalleId: string;
  cantidadRecibida: number;
  almacenId: string;
  numeroLote?: string | null;
  fechaVencimiento?: string | null;
}

export async function recibirOrdenCompra(ordenId: string, items: RecibirItemInput[], usuarioId: string) {
  const orden = await prisma.ordenCompra.findUnique({ where: { id: ordenId }, include: { detalles: true } });
  if (!orden) throw new HttpError(404, "Orden de compra no encontrada");
  if (orden.estado === "CANCELADA") throw new HttpError(400, "La orden está cancelada");

  for (const item of items) {
    const detalle = orden.detalles.find((d) => d.id === item.detalleId);
    if (!detalle) throw new HttpError(400, `El detalle ${item.detalleId} no pertenece a esta orden`);

    const pendiente = Number(detalle.cantidadPedida) - Number(detalle.cantidadRecibida);
    if (item.cantidadRecibida > pendiente) {
      throw new HttpError(400, `No se puede recibir más de lo pendiente (${pendiente}) para ${detalle.productoId}`);
    }

    await stockService.registrarIngreso(
      {
        productoId: detalle.productoId,
        almacenId: item.almacenId,
        cantidad: item.cantidadRecibida,
        costoUnitario: Number(detalle.costoUnitarioPactado),
        numeroLote: item.numeroLote,
        fechaVencimiento: item.fechaVencimiento,
        proveedorId: orden.proveedorId,
      },
      usuarioId
    );

    await prisma.detalleOrdenCompra.update({
      where: { id: detalle.id },
      data: { cantidadRecibida: { increment: item.cantidadRecibida } },
    });
  }

  const detallesActualizados = await prisma.detalleOrdenCompra.findMany({ where: { ordenCompraId: ordenId } });
  const completa = detallesActualizados.every((d) => Number(d.cantidadRecibida) >= Number(d.cantidadPedida));
  const algunaRecibida = detallesActualizados.some((d) => Number(d.cantidadRecibida) > 0);

  return prisma.ordenCompra.update({
    where: { id: ordenId },
    data: { estado: completa ? "RECIBIDA_COMPLETA" : algunaRecibida ? "RECIBIDA_PARCIAL" : "PENDIENTE" },
    include: { detalles: true },
  });
}

export async function cancelarOrdenCompra(ordenId: string) {
  const orden = await prisma.ordenCompra.findUnique({ where: { id: ordenId } });
  if (!orden) throw new HttpError(404, "Orden de compra no encontrada");
  if (orden.estado !== "PENDIENTE") throw new HttpError(400, "Solo se pueden cancelar órdenes pendientes");
  return prisma.ordenCompra.update({ where: { id: ordenId }, data: { estado: "CANCELADA" } });
}

export async function listaReposicionPorProveedor() {
  const productos = await prisma.producto.findMany({
    where: { activo: true, proveedorPrincipalId: { not: null } },
    include: {
      lotes: { select: { cantidadActual: true } },
      proveedorPrincipal: { select: { id: true, nombre: true } },
    },
  });

  const aReponer = productos
    .map((p) => ({
      ...p,
      stockActual: p.lotes.reduce((acc, l) => acc + Number(l.cantidadActual), 0),
    }))
    .filter((p) => p.stockActual <= Number(p.puntoReposicion));

  const porProveedor = new Map<string, { proveedor: { id: string; nombre: string }; productos: typeof aReponer }>();
  for (const producto of aReponer) {
    const proveedor = producto.proveedorPrincipal!;
    if (!porProveedor.has(proveedor.id)) {
      porProveedor.set(proveedor.id, { proveedor, productos: [] });
    }
    porProveedor.get(proveedor.id)!.productos.push(producto);
  }

  return Array.from(porProveedor.values());
}
