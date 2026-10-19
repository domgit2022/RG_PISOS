import { prisma } from "@/lib/prisma.js";
import { HttpError } from "@/lib/http-error.js";

export async function listPrecios(listaPrecioId: string) {
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      sku: true,
      costoPromedio: true,
      precios: {
        where: { listaPrecioId, vigenteHasta: null, activo: true },
        take: 1,
      },
    },
  });

  return productos.map((producto) => {
    const { precios, ...resto } = producto;
    return { ...resto, precioVigente: precios[0] ?? null };
  });
}

export interface SetPrecioInput {
  productoId: string;
  listaPrecioId: string;
  precio: number;
  margenPorcentaje?: number | null;
}

export async function setPrecio(input: SetPrecioInput) {
  const [producto, lista] = await Promise.all([
    prisma.producto.findUnique({ where: { id: input.productoId } }),
    prisma.listaPrecio.findUnique({ where: { id: input.listaPrecioId } }),
  ]);
  if (!producto) throw new HttpError(404, "Producto no encontrado");
  if (!lista) throw new HttpError(404, "Lista de precios no encontrada");

  return prisma.$transaction(async (tx) => {
    const ahora = new Date();
    await tx.precioProducto.updateMany({
      where: { productoId: input.productoId, listaPrecioId: input.listaPrecioId, vigenteHasta: null },
      data: { vigenteHasta: ahora, activo: false },
    });

    return tx.precioProducto.create({
      data: {
        productoId: input.productoId,
        listaPrecioId: input.listaPrecioId,
        precio: input.precio,
        margenPorcentaje: input.margenPorcentaje,
        vigenteDesde: ahora,
      },
    });
  });
}

export async function listHistorialPrecios(productoId: string, listaPrecioId: string) {
  return prisma.precioProducto.findMany({
    where: { productoId, listaPrecioId },
    orderBy: { vigenteDesde: "desc" },
  });
}
