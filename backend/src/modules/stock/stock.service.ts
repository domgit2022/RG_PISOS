import type { Prisma } from "../../generated/prisma/index.js";
import { prisma } from "@/lib/prisma.js";
import { HttpError } from "@/lib/http-error.js";

type Db = typeof prisma | Prisma.TransactionClient;

async function stockTotalProducto(productoId: string, tx: Db = prisma) {
  const lotes = await tx.lote.findMany({ where: { productoId }, select: { cantidadActual: true } });
  return lotes.reduce((acc, l) => acc + Number(l.cantidadActual), 0);
}

export interface RegistrarIngresoInput {
  productoId: string;
  almacenId: string;
  ubicacionId?: string | null;
  cantidad: number;
  costoUnitario: number;
  numeroLote?: string | null;
  fechaVencimiento?: string | null;
  proveedorId?: string | null;
}

const fechaIso = (fecha: Date) => fecha.toISOString().slice(0, 10);

/**
 * Registra un ingreso de stock. El stock se lleva por material + almacén +
 * lote (si controla lote) + vencimiento (si controla vencimiento):
 * - Con control de lote el número es obligatorio; sin control no se guarda.
 * - Con control de vencimiento la fecha es obligatoria. Si además controla
 *   lote, la fecha es un dato del lote: si el lote ya existe, se usa la fecha
 *   ya cargada.
 * - Si ya hay stock con la misma combinación en ese almacén, se acumula ahí.
 * Si se le pasa `txExterna` corre dentro de esa transacción (ej: alta de
 * producto + stock inicial, todo o nada).
 */
export async function registrarIngreso(
  input: RegistrarIngresoInput,
  usuarioId: string,
  txExterna?: Prisma.TransactionClient
) {
  const db: Db = txExterna ?? prisma;
  const producto = await db.producto.findUnique({ where: { id: input.productoId } });
  if (!producto) throw new HttpError(404, "Producto no encontrado");

  let numeroLote = producto.controlaLote ? input.numeroLote?.trim() || null : null;
  let fechaVencimiento = producto.controlaVencimiento ? input.fechaVencimiento?.slice(0, 10) || null : null;

  if (producto.controlaLote && !numeroLote) {
    throw new HttpError(400, "Este material controla lote: el número de lote es obligatorio");
  }
  if (numeroLote) {
    // Lote ya cargado (sin distinguir mayúsculas): se usa tal cual está y, si
    // tiene vencimiento, manda la fecha ya cargada para ese lote.
    const mismoLote = await db.lote.findFirst({
      where: { productoId: producto.id, numeroLote: { equals: numeroLote, mode: "insensitive" } },
      orderBy: { fechaIngreso: "asc" },
      select: { numeroLote: true, fechaVencimiento: true },
    });
    if (mismoLote?.numeroLote) {
      numeroLote = mismoLote.numeroLote;
      if (producto.controlaVencimiento && mismoLote.fechaVencimiento) {
        fechaVencimiento = fechaIso(mismoLote.fechaVencimiento);
      }
    }
  }
  if (producto.controlaVencimiento && !fechaVencimiento) {
    throw new HttpError(400, "Este material controla vencimiento: la fecha de vencimiento es obligatoria");
  }

  const ejecutar = async (tx: Prisma.TransactionClient) => {
    const existente = await tx.lote.findFirst({
      where: {
        productoId: producto.id,
        almacenId: input.almacenId,
        numeroLote,
        // Con lote, la fecha viene dada por el lote; sin lote, el vencimiento separa el stock.
        ...(numeroLote ? {} : { fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null }),
      },
      orderBy: { fechaIngreso: "asc" },
    });

    let lote;
    if (existente) {
      const cantidadPrevia = Number(existente.cantidadActual);
      const total = cantidadPrevia + input.cantidad;
      const costoUnitario =
        total > 0 ? (Number(existente.costoUnitario) * cantidadPrevia + input.costoUnitario * input.cantidad) / total : input.costoUnitario;
      lote = await tx.lote.update({
        where: { id: existente.id },
        data: {
          cantidadActual: { increment: input.cantidad },
          cantidadInicial: { increment: input.cantidad },
          costoUnitario,
          ...(fechaVencimiento && !existente.fechaVencimiento ? { fechaVencimiento: new Date(fechaVencimiento) } : {}),
          ...(input.ubicacionId && !existente.ubicacionId ? { ubicacionId: input.ubicacionId } : {}),
        },
      });
    } else {
      lote = await tx.lote.create({
        data: {
          productoId: producto.id,
          almacenId: input.almacenId,
          ubicacionId: input.ubicacionId,
          numeroLote,
          fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
          cantidadInicial: input.cantidad,
          cantidadActual: input.cantidad,
          proveedorId: input.proveedorId,
          costoUnitario: input.costoUnitario,
        },
      });
    }

    const stockResultante = await stockTotalProducto(input.productoId, tx);
    const stockAntes = stockResultante - input.cantidad;

    const costoPromedioAnterior = Number(producto.costoPromedio);
    const costoPromedioNuevo =
      stockAntes + input.cantidad > 0
        ? (costoPromedioAnterior * stockAntes + input.costoUnitario * input.cantidad) / (stockAntes + input.cantidad)
        : input.costoUnitario;

    await tx.producto.update({
      where: { id: input.productoId },
      data: { costoPromedio: costoPromedioNuevo },
    });

    await tx.movimientoStock.create({
      data: {
        productoId: input.productoId,
        loteId: lote.id,
        almacenId: input.almacenId,
        ubicacionId: input.ubicacionId,
        tipo: "INGRESO",
        cantidad: input.cantidad,
        stockResultante,
        usuarioId,
      },
    });

    return lote;
  };

  return txExterna ? ejecutar(txExterna) : prisma.$transaction(ejecutar);
}

export interface RegistrarAjusteInput {
  loteId: string;
  tipo: "AJUSTE" | "MERMA";
  cantidad: number;
  motivo: string;
}

export async function registrarAjusteOMerma(input: RegistrarAjusteInput, usuarioId: string) {
  const lote = await prisma.lote.findUnique({ where: { id: input.loteId } });
  if (!lote) throw new HttpError(404, "Lote no encontrado");

  const delta = input.tipo === "MERMA" ? -Math.abs(input.cantidad) : input.cantidad;
  const nuevaCantidad = Number(lote.cantidadActual) + delta;
  if (nuevaCantidad < 0) {
    throw new HttpError(400, "La cantidad resultante no puede ser negativa");
  }

  return prisma.$transaction(async (tx) => {
    await tx.lote.update({ where: { id: lote.id }, data: { cantidadActual: nuevaCantidad } });
    const stockResultante = await stockTotalProducto(lote.productoId, tx);

    return tx.movimientoStock.create({
      data: {
        productoId: lote.productoId,
        loteId: lote.id,
        almacenId: lote.almacenId,
        ubicacionId: lote.ubicacionId,
        tipo: input.tipo,
        cantidad: delta,
        stockResultante,
        usuarioId,
        motivo: input.motivo,
      },
    });
  });
}

export interface ListLotesParams {
  productoId?: string;
  soloVencidos?: boolean;
  soloPorVencer?: boolean;
  diasPorVencer?: number;
}

export async function listLotes(params: ListLotesParams) {
  const hoy = new Date();
  const limitePorVencer = new Date();
  limitePorVencer.setDate(limitePorVencer.getDate() + (params.diasPorVencer ?? 30));

  const lotes = await prisma.lote.findMany({
    where: {
      cantidadActual: { gt: 0 },
      ...(params.productoId ? { productoId: params.productoId } : {}),
      ...(params.soloVencidos ? { fechaVencimiento: { lt: hoy } } : {}),
      ...(params.soloPorVencer ? { fechaVencimiento: { gte: hoy, lte: limitePorVencer } } : {}),
    },
    orderBy: [{ producto: { nombre: "asc" } }, { fechaVencimiento: "asc" }, { fechaIngreso: "asc" }],
    include: {
      producto: { select: { id: true, nombre: true, sku: true, controlaVencimiento: true, controlaLote: true } },
      almacen: { select: { id: true, nombre: true } },
      ubicacion: { select: { id: true, nombre: true } },
    },
  });

  return lotes.map((lote) => ({
    ...lote,
    estado: lote.fechaVencimiento
      ? lote.fechaVencimiento < hoy
        ? ("VENCIDO" as const)
        : lote.fechaVencimiento <= limitePorVencer
          ? ("POR_VENCER" as const)
          : ("OK" as const)
      : ("OK" as const),
  }));
}

export async function listMovimientos(productoId: string) {
  return prisma.movimientoStock.findMany({
    where: { productoId },
    orderBy: { fecha: "desc" },
    include: {
      lote: { select: { numeroLote: true, fechaVencimiento: true } },
      usuario: { select: { nombreCompleto: true } },
      almacen: { select: { nombre: true } },
    },
  });
}

/**
 * Números de lote ya usados por un material (aunque hoy estén en cero), con
 * su vencimiento. Sirve para sugerir el lote al cargar stock y completar la
 * fecha sola cuando se repite un lote existente.
 */
export async function listarLotesConocidos(productoId: string) {
  const lotes = await prisma.lote.findMany({
    where: { productoId, numeroLote: { not: null } },
    distinct: ["numeroLote"],
    orderBy: [{ numeroLote: "asc" }],
    select: { numeroLote: true, fechaVencimiento: true },
  });
  return lotes.map((l) => ({
    numeroLote: l.numeroLote!,
    fechaVencimiento: l.fechaVencimiento ? fechaIso(l.fechaVencimiento) : null,
  }));
}

/**
 * Stock disponible por material (primer nivel de la pantalla Stock): total,
 * apertura por almacén, próximo vencimiento y estado más crítico de sus lotes.
 */
export async function resumenStock() {
  const hoy = new Date();
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      sku: true,
      controlaLote: true,
      controlaVencimiento: true,
      diasAvisoVencimiento: true,
      puntoReposicion: true,
      unidadMedida: { select: { codigo: true } },
      lotes: {
        where: { cantidadActual: { gt: 0 } },
        select: { cantidadActual: true, fechaVencimiento: true, almacen: { select: { id: true, nombre: true } } },
      },
    },
  });

  return productos.map((p) => {
    const porAlmacen = new Map<string, { almacen: string; cantidad: number }>();
    let proximoVencimiento: Date | null = null;
    for (const l of p.lotes) {
      const fila = porAlmacen.get(l.almacen.id) ?? { almacen: l.almacen.nombre, cantidad: 0 };
      fila.cantidad += Number(l.cantidadActual);
      porAlmacen.set(l.almacen.id, fila);
      if (p.controlaVencimiento && l.fechaVencimiento && (!proximoVencimiento || l.fechaVencimiento < proximoVencimiento)) {
        proximoVencimiento = l.fechaVencimiento;
      }
    }
    const total = p.lotes.reduce((acc, l) => acc + Number(l.cantidadActual), 0);
    const limiteAviso = new Date(hoy);
    limiteAviso.setDate(limiteAviso.getDate() + p.diasAvisoVencimiento);
    const estado: "VENCIDO" | "POR_VENCER" | "OK" = !proximoVencimiento
      ? "OK"
      : proximoVencimiento < hoy
        ? "VENCIDO"
        : proximoVencimiento <= limiteAviso
          ? "POR_VENCER"
          : "OK";

    return {
      productoId: p.id,
      nombre: p.nombre,
      sku: p.sku,
      unidad: p.unidadMedida.codigo,
      controlaLote: p.controlaLote,
      controlaVencimiento: p.controlaVencimiento,
      total,
      aReponer: total <= Number(p.puntoReposicion),
      porAlmacen: [...porAlmacen.values()].sort((a, b) => b.cantidad - a.cantidad),
      proximoVencimiento: proximoVencimiento ? fechaIso(proximoVencimiento) : null,
      estado,
    };
  });
}
