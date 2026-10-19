import { prisma } from "@/lib/prisma.js";
import { listarLotesProximosAVencer, diasRestantesHasta } from "@/lib/vencimientos.js";

export async function stockValorizado() {
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    include: {
      categoria: { select: { id: true, nombre: true } },
      lotes: { select: { cantidadActual: true } },
      precios: { where: { activo: true, vigenteHasta: null }, take: 1 },
    },
  });

  let valorTotalCosto = 0;
  let valorTotalVenta = 0;
  const porCategoria = new Map<string, { categoria: string; valorCosto: number; valorVenta: number }>();

  for (const producto of productos) {
    const stock = producto.lotes.reduce((acc, l) => acc + Number(l.cantidadActual), 0);
    const valorCosto = stock * Number(producto.costoPromedio);
    const precioVenta = producto.precios[0] ? Number(producto.precios[0].precio) : 0;
    const valorVenta = stock * precioVenta;

    valorTotalCosto += valorCosto;
    valorTotalVenta += valorVenta;

    const nombreCategoria = producto.categoria?.nombre ?? "Sin categoría";
    if (!porCategoria.has(nombreCategoria)) {
      porCategoria.set(nombreCategoria, { categoria: nombreCategoria, valorCosto: 0, valorVenta: 0 });
    }
    const entry = porCategoria.get(nombreCategoria)!;
    entry.valorCosto += valorCosto;
    entry.valorVenta += valorVenta;
  }

  return { valorTotalCosto, valorTotalVenta, porCategoria: Array.from(porCategoria.values()) };
}

/**
 * Usa el mismo criterio que el recordatorio diario por mail (ver
 * alerts.service.verificarVencimientosProximos): la ventana de "a vencer" es
 * la que cada producto tiene configurada en Producto.diasAvisoVencimiento, no
 * un número de días fijo para todos.
 */
export async function productosAVencer() {
  const { lotes } = await listarLotesProximosAVencer();

  return lotes.map((l) => ({
    producto: l.producto.nombre,
    sku: l.producto.sku,
    numeroLote: l.numeroLote,
    fechaVencimiento: l.fechaVencimiento,
    diasRestantes: diasRestantesHasta(l.fechaVencimiento),
    cantidad: l.cantidad,
    valorEnRiesgo: l.cantidad * l.costoUnitario,
  }));
}

export interface ProductoStockBajo {
  nombre: string;
  sku: string;
  categoria: string;
  stockActual: number;
  puntoReposicion: number;
}

export async function productosStockBajo(): Promise<ProductoStockBajo[]> {
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    include: { lotes: { select: { cantidadActual: true } }, categoria: { select: { nombre: true } } },
  });

  return productos
    .map((p) => ({
      nombre: p.nombre,
      sku: p.sku,
      categoria: p.categoria?.nombre ?? "Sin categoría",
      stockActual: p.lotes.reduce((acc, l) => acc + Number(l.cantidadActual), 0),
      puntoReposicion: Number(p.puntoReposicion),
    }))
    .filter((p) => p.stockActual <= p.puntoReposicion);
}

export async function ventasPorPeriodo(desde: Date, hasta: Date) {
  const ventas = await prisma.venta.findMany({
    where: { fecha: { gte: desde, lte: hasta }, estado: "CONFIRMADA" },
    include: {
      detalles: { include: { producto: { select: { nombre: true, categoriaId: true, categoria: { select: { nombre: true } } } } } },
      usuario: { select: { nombreCompleto: true } },
    },
  });

  const total = ventas.reduce((acc, v) => acc + Number(v.total), 0);
  const porProducto = new Map<string, { producto: string; cantidad: number; total: number }>();
  const porCategoria = new Map<string, { categoria: string; total: number }>();
  const porVendedor = new Map<string, { vendedor: string; total: number }>();

  for (const venta of ventas) {
    const vendedor = venta.usuario.nombreCompleto;
    porVendedor.set(vendedor, { vendedor, total: (porVendedor.get(vendedor)?.total ?? 0) + Number(venta.total) });

    for (const detalle of venta.detalles) {
      const nombreProducto = detalle.producto.nombre;
      const entryProducto = porProducto.get(nombreProducto) ?? { producto: nombreProducto, cantidad: 0, total: 0 };
      entryProducto.cantidad += Number(detalle.cantidad);
      entryProducto.total += Number(detalle.subtotal);
      porProducto.set(nombreProducto, entryProducto);

      const nombreCategoria = detalle.producto.categoria?.nombre ?? "Sin categoría";
      porCategoria.set(nombreCategoria, {
        categoria: nombreCategoria,
        total: (porCategoria.get(nombreCategoria)?.total ?? 0) + Number(detalle.subtotal),
      });
    }
  }

  return {
    totalVentas: ventas.length,
    totalFacturado: total,
    porProducto: Array.from(porProducto.values()).sort((a, b) => b.cantidad - a.cantidad),
    porCategoria: Array.from(porCategoria.values()),
    porVendedor: Array.from(porVendedor.values()),
  };
}

export async function mermasYAjustes(desde: Date, hasta: Date) {
  const movimientos = await prisma.movimientoStock.findMany({
    where: { tipo: { in: ["MERMA", "AJUSTE"] }, fecha: { gte: desde, lte: hasta } },
    include: { producto: { select: { nombre: true, sku: true, costoPromedio: true } }, usuario: { select: { nombreCompleto: true } } },
    orderBy: { fecha: "desc" },
  });

  const valorTotalPerdido = movimientos
    .filter((m) => Number(m.cantidad) < 0)
    .reduce((acc, m) => acc + Math.abs(Number(m.cantidad)) * Number(m.producto.costoPromedio), 0);

  return { movimientos, valorTotalPerdido };
}
