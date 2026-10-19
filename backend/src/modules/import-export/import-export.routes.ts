import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";
import { HttpError } from "@/lib/http-error.js";
import { sendWorkbook } from "@/lib/excel.js";
import { zBooleanFlexible } from "@/lib/zod-helpers.js";
import * as importExportService from "./import-export.service.js";

export const importExportRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

importExportRouter.get(
  "/productos/exportar",
  requireAuth,
  requirePermiso("datos.exportar"),
  asyncHandler(async (_req, res) => {
    const productos = await importExportService.exportProductos();
    await sendWorkbook(res, "productos.xlsx", [
      {
        name: "Productos",
        columns: [
          { header: "sku", key: "sku", width: 16 },
          { header: "nombre", key: "nombre", width: 30 },
          { header: "categoria", key: "categoria", width: 20 },
          { header: "marca", key: "marca", width: 16 },
          { header: "unidad_medida", key: "unidad_medida", width: 14 },
          { header: "stock_minimo", key: "stock_minimo", width: 14 },
          { header: "punto_reposicion", key: "punto_reposicion", width: 16 },
          { header: "stock_maximo", key: "stock_maximo", width: 14 },
          { header: "costo_promedio", key: "costo_promedio", width: 16 },
        ],
        rows: productos.map((p) => ({
          sku: p.sku,
          nombre: p.nombre,
          categoria: p.categoria?.nombre ?? "",
          marca: p.marca ?? "",
          unidad_medida: p.unidadMedida.codigo,
          stock_minimo: Number(p.stockMinimo),
          punto_reposicion: Number(p.puntoReposicion),
          stock_maximo: p.stockMaximo ? Number(p.stockMaximo) : "",
          costo_promedio: Number(p.costoPromedio),
        })),
      },
    ]);
  })
);

importExportRouter.get(
  "/listas-precio/:id/exportar",
  requireAuth,
  requirePermiso("datos.exportar"),
  asyncHandler(async (req, res) => {
    const { lista, precios } = await importExportService.exportListaPrecio(req.params.id);
    await sendWorkbook(res, `lista-precios-${lista.nombre}.xlsx`, [
      {
        name: lista.nombre,
        columns: [
          { header: "sku", key: "sku", width: 16 },
          { header: "producto", key: "producto", width: 30 },
          { header: "precio", key: "precio", width: 14 },
          { header: "vigente_desde", key: "vigente_desde", width: 16 },
        ],
        rows: precios.map((p) => ({
          sku: p.producto.sku,
          producto: p.producto.nombre,
          precio: Number(p.precio),
          vigente_desde: p.vigenteDesde,
        })),
      },
    ]);
  })
);

const importarQuerySchema = z.object({ aplicar: zBooleanFlexible.default(false) });

importExportRouter.post(
  "/productos/importar",
  requireAuth,
  requirePermiso("datos.importar"),
  upload.single("archivo"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Falta el archivo a importar");
    const { aplicar } = importarQuerySchema.parse(req.query);
    res.json(await importExportService.importarProductos(req.file.buffer, aplicar));
  })
);
