import { prisma } from "@/lib/prisma.js";

export interface LoteProximoAVencer {
  producto: {
    id: string;
    nombre: string;
    sku: string;
    stockMinimo: number;
    puntoReposicion: number;
    stockMaximo: number | null;
    proveedorPrincipal: { nombre: string; telefono: string | null; email: string | null } | null;
  };
  stockActual: number;
  loteId: string;
  numeroLote: string | null;
  fechaVencimiento: Date;
  cantidad: number;
  costoUnitario: number;
}

/**
 * Lotes con stock que caen dentro de la ventana de aviso propia de cada
 * producto (Producto.diasAvisoVencimiento) — el mismo criterio que usa el
 * recordatorio diario por mail (alerts.service) y el reporte de "productos a
 * vencer" (reports.service), para que ambos muestren siempre lo mismo.
 * Incluye lotes ya vencidos con stock, porque igual requieren acción.
 */
export async function listarLotesProximosAVencer(): Promise<{
  lotes: LoteProximoAVencer[];
  productosRevisados: number;
}> {
  const productos = await prisma.producto.findMany({
    where: { activo: true, controlaVencimiento: true },
    include: {
      lotes: {
        where: { cantidadActual: { gt: 0 } },
        select: { id: true, cantidadActual: true, fechaVencimiento: true, numeroLote: true, costoUnitario: true },
      },
      proveedorPrincipal: { select: { nombre: true, telefono: true, email: true } },
    },
  });

  const lotes: LoteProximoAVencer[] = [];

  for (const producto of productos) {
    const stockActual = producto.lotes.reduce((acc, l) => acc + Number(l.cantidadActual), 0);
    const limite = new Date();
    limite.setDate(limite.getDate() + producto.diasAvisoVencimiento);

    for (const lote of producto.lotes) {
      if (!lote.fechaVencimiento || lote.fechaVencimiento > limite) continue;

      lotes.push({
        producto: {
          id: producto.id,
          nombre: producto.nombre,
          sku: producto.sku,
          stockMinimo: Number(producto.stockMinimo),
          puntoReposicion: Number(producto.puntoReposicion),
          stockMaximo: producto.stockMaximo !== null ? Number(producto.stockMaximo) : null,
          proveedorPrincipal: producto.proveedorPrincipal,
        },
        stockActual,
        loteId: lote.id,
        numeroLote: lote.numeroLote,
        fechaVencimiento: lote.fechaVencimiento,
        cantidad: Number(lote.cantidadActual),
        costoUnitario: Number(lote.costoUnitario),
      });
    }
  }

  lotes.sort((a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime());

  return { lotes, productosRevisados: productos.length };
}

/**
 * Días entre hoy y la fecha dada (redondeado, sin contar horas). Negativo si
 * la fecha ya pasó. Se usa tanto en el mail como en el reporte de
 * "productos a vencer" para que el número mostrado sea siempre el mismo.
 */
export function diasRestantesHasta(fecha: Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}
