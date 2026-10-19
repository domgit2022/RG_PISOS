import { Prisma } from "../../generated/prisma/index.js";
import { prisma } from "@/lib/prisma.js";
import { HttpError } from "@/lib/http-error.js";
import { registrarIngreso, type RegistrarIngresoInput } from "@/modules/stock/stock.service.js";

export interface ListProductsParams {
  page: number;
  pageSize: number;
  search?: string;
  categoriaId?: string;
  soloAReponer?: boolean;
}

export async function listProducts({ page, pageSize, search, categoriaId, soloAReponer }: ListProductsParams) {
  const where: Prisma.ProductoWhereInput = {
    activo: true,
    ...(categoriaId ? { categoriaId } : {}),
    ...(search
      ? {
          OR: [
            { nombre: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { codigoBarras: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, productos] = await prisma.$transaction([
    prisma.producto.count({ where }),
    prisma.producto.findMany({
      where,
      orderBy: { nombre: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        categoria: { select: { id: true, nombre: true } },
        unidadMedida: { select: { id: true, nombre: true, codigo: true } },
        lotes: { select: { cantidadActual: true } },
      },
    }),
  ]);

  const items = productos
    .map((producto) => {
      const stockActual = producto.lotes.reduce((acc, lote) => acc + Number(lote.cantidadActual), 0);
      const { lotes, ...resto } = producto;
      return {
        ...resto,
        stockActual,
        aReponer: stockActual <= Number(producto.puntoReposicion),
      };
    })
    .filter((p) => (soloAReponer ? p.aReponer : true));

  return {
    items,
    total: soloAReponer ? items.length : total,
    page,
    pageSize,
  };
}

export async function getProductByBarcode(codigoBarras: string) {
  const producto = await prisma.producto.findFirst({
    where: { activo: true, codigoBarras },
    include: {
      categoria: { select: { id: true, nombre: true } },
      unidadMedida: { select: { id: true, nombre: true, codigo: true } },
      lotes: { select: { cantidadActual: true } },
    },
  });
  if (!producto) return null;

  const stockActual = producto.lotes.reduce((acc, lote) => acc + Number(lote.cantidadActual), 0);
  const { lotes, ...resto } = producto;
  return {
    ...resto,
    stockActual,
    aReponer: stockActual <= Number(producto.puntoReposicion),
  };
}

export interface CreateProductInput {
  sku: string;
  codigoBarras?: string | null;
  nombre: string;
  descripcion?: string | null;
  categoriaId?: string | null;
  marca?: string | null;
  unidadMedidaId: string;
  proveedorPrincipalId?: string | null;
  imagenUrl?: string | null;
  controlaVencimiento: boolean;
  diasAvisoVencimiento?: number;
  controlaLote: boolean;
  stockMinimo: number;
  puntoReposicion: number;
  stockMaximo?: number | null;
  activo?: boolean;
}

export type StockInicialInput = Omit<RegistrarIngresoInput, "productoId">;

/**
 * Crea el producto y, si viene, su stock inicial en la misma transacción:
 * si el ingreso falla (ej: falta la fecha de vencimiento) no queda un
 * producto creado sin su stock.
 */
export async function createProduct(input: CreateProductInput, stockInicial?: StockInicialInput, usuarioId?: string) {
  return prisma.$transaction(async (tx) => {
    const producto = await tx.producto.create({ data: input });
    if (stockInicial && usuarioId) {
      await registrarIngreso({ ...stockInicial, productoId: producto.id }, usuarioId, tx);
    }
    return producto;
  });
}

export type UpdateProductInput = Partial<CreateProductInput> & { activo?: boolean };

export async function updateProduct(id: string, input: UpdateProductInput) {
  if (input.controlaLote !== undefined || input.controlaVencimiento !== undefined) {
    const actual = await prisma.producto.findUnique({
      where: { id },
      select: { controlaLote: true, controlaVencimiento: true, lotes: { select: { cantidadActual: true } } },
    });
    if (!actual) throw new HttpError(404, "Producto no encontrado");

    const controlaVencimiento = input.controlaVencimiento ?? actual.controlaVencimiento;
    const controlaLote = input.controlaLote ?? actual.controlaLote;
    const cambia = controlaLote !== actual.controlaLote || controlaVencimiento !== actual.controlaVencimiento;
    const stock = actual.lotes.reduce((acc, l) => acc + Number(l.cantidadActual), 0);
    if (cambia && stock > 0) {
      throw new HttpError(
        400,
        "No se puede cambiar el control de lote o vencimiento de un material con stock. Dejá el stock en cero (ajuste) y volvé a intentar."
      );
    }
    input = { ...input, controlaLote, controlaVencimiento };
  }
  return prisma.producto.update({ where: { id }, data: input });
}
