import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma.js";
import { HttpError } from "@/lib/http-error.js";

export async function exportProductos() {
  return prisma.producto.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    include: { categoria: { select: { nombre: true } }, unidadMedida: { select: { codigo: true } } },
  });
}

export async function exportListaPrecio(listaPrecioId: string) {
  const lista = await prisma.listaPrecio.findUnique({ where: { id: listaPrecioId } });
  if (!lista) throw new HttpError(404, "Lista de precios no encontrada");

  const precios = await prisma.precioProducto.findMany({
    where: { listaPrecioId, vigenteHasta: null, activo: true },
    include: { producto: { select: { nombre: true, sku: true } } },
    orderBy: { producto: { nombre: "asc" } },
  });

  return { lista, precios };
}

interface FilaImportacion {
  fila: number;
  sku: string;
  nombre: string;
  categoriaNombre?: string;
  marca?: string;
  unidadMedidaCodigo: string;
  stockMinimo?: number;
  puntoReposicion?: number;
  stockMaximo?: number;
}

interface ResultadoImportacion {
  aCrear: number;
  aActualizar: number;
  errores: { fila: number; mensaje: string }[];
  aplicado: boolean;
}

const COLUMNAS_ESPERADAS = [
  "sku",
  "nombre",
  "categoria",
  "marca",
  "unidad_medida",
  "stock_minimo",
  "punto_reposicion",
  "stock_maximo",
];

export async function importarProductos(buffer: Buffer, aplicar: boolean): Promise<ResultadoImportacion> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new HttpError(400, "El archivo no tiene hojas");

  const headerRow = worksheet.getRow(1).values as unknown[];
  const headers = headerRow.slice(1).map((h) => String(h ?? "").trim().toLowerCase());

  const faltantes = COLUMNAS_ESPERADAS.filter((c) => !headers.includes(c));
  if (faltantes.length > 0) {
    throw new HttpError(400, `Faltan columnas obligatorias en el archivo: ${faltantes.join(", ")}`);
  }

  const idx = (col: string) => headers.indexOf(col);
  const filas: FilaImportacion[] = [];
  const errores: { fila: number; mensaje: string }[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const valores = row.values as unknown[];
    const get = (col: string) => valores[idx(col) + 1];

    const sku = String(get("sku") ?? "").trim();
    const nombre = String(get("nombre") ?? "").trim();
    const unidadMedidaCodigo = String(get("unidad_medida") ?? "").trim().toUpperCase();

    if (!sku || !nombre || !unidadMedidaCodigo) {
      errores.push({ fila: rowNumber, mensaje: "SKU, nombre y unidad de medida son obligatorios" });
      return;
    }

    filas.push({
      fila: rowNumber,
      sku,
      nombre,
      categoriaNombre: String(get("categoria") ?? "").trim() || undefined,
      marca: String(get("marca") ?? "").trim() || undefined,
      unidadMedidaCodigo,
      stockMinimo: Number(get("stock_minimo") ?? 0) || 0,
      puntoReposicion: Number(get("punto_reposicion") ?? 0) || 0,
      stockMaximo: get("stock_maximo") ? Number(get("stock_maximo")) : undefined,
    });
  });

  const skusVistos = new Set<string>();
  for (const fila of filas) {
    if (skusVistos.has(fila.sku)) {
      errores.push({ fila: fila.fila, mensaje: `Material duplicado dentro del archivo: ${fila.sku}` });
    }
    skusVistos.add(fila.sku);
  }

  const unidades = await prisma.unidadMedida.findMany();
  const unidadPorCodigo = new Map(unidades.map((u) => [u.codigo, u.id]));
  const categorias = await prisma.categoria.findMany();
  const categoriaPorNombre = new Map(categorias.map((c) => [c.nombre.toLowerCase(), c.id]));
  const productosExistentes = await prisma.producto.findMany({ where: { sku: { in: filas.map((f) => f.sku) } } });
  const productoPorSku = new Map(productosExistentes.map((p) => [p.sku, p]));

  let aCrear = 0;
  let aActualizar = 0;
  const filasValidas: FilaImportacion[] = [];

  for (const fila of filas) {
    if (!unidadPorCodigo.has(fila.unidadMedidaCodigo)) {
      errores.push({ fila: fila.fila, mensaje: `Unidad de medida desconocida: ${fila.unidadMedidaCodigo}` });
      continue;
    }
    if (fila.categoriaNombre && !categoriaPorNombre.has(fila.categoriaNombre.toLowerCase())) {
      errores.push({ fila: fila.fila, mensaje: `Categoría desconocida: ${fila.categoriaNombre}` });
      continue;
    }
    filasValidas.push(fila);
    if (productoPorSku.has(fila.sku)) aActualizar += 1;
    else aCrear += 1;
  }

  if (aplicar && errores.length === 0) {
    for (const fila of filasValidas) {
      const data = {
        nombre: fila.nombre,
        marca: fila.marca ?? null,
        categoriaId: fila.categoriaNombre ? categoriaPorNombre.get(fila.categoriaNombre.toLowerCase())! : null,
        unidadMedidaId: unidadPorCodigo.get(fila.unidadMedidaCodigo)!,
        stockMinimo: fila.stockMinimo ?? 0,
        puntoReposicion: fila.puntoReposicion ?? 0,
        stockMaximo: fila.stockMaximo ?? null,
      };

      await prisma.producto.upsert({
        where: { sku: fila.sku },
        update: data,
        create: { sku: fila.sku, ...data },
      });
    }
  }

  return { aCrear, aActualizar, errores, aplicado: aplicar && errores.length === 0 };
}
