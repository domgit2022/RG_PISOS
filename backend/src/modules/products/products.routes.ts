import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";
import { zBooleanFlexible } from "@/lib/zod-helpers.js";
import { ocultarCostoSiCorresponde } from "@/lib/visibility.js";
import { HttpError } from "@/lib/http-error.js";
import { subirArchivoPublico } from "@/lib/storage.js";
import * as productsService from "./products.service.js";

export const productsRouter = Router();

const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.mimetype)) {
      cb(new HttpError(400, "Formato de imagen no soportado (usá PNG, JPG, SVG o WEBP)"));
      return;
    }
    cb(null, true);
  },
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  categoriaId: z.string().optional(),
  soloAReponer: zBooleanFlexible.optional(),
});

productsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const resultado = await productsService.listProducts(query);
    res.json({ ...resultado, items: ocultarCostoSiCorresponde(resultado.items, req.auth!.permisos) });
  })
);

productsRouter.get(
  "/codigo/:codigo",
  requireAuth,
  asyncHandler(async (req, res) => {
    const producto = await productsService.getProductByBarcode(req.params.codigo);
    if (!producto) throw new HttpError(404, "No existe un material con ese código de barras");
    res.json(ocultarCostoSiCorresponde([producto], req.auth!.permisos)[0]);
  })
);

const createProductSchema = z.object({
  sku: z.string().min(1),
  codigoBarras: z.string().nullish(),
  nombre: z.string().min(1),
  descripcion: z.string().nullish(),
  categoriaId: z.string().nullish(),
  marca: z.string().nullish(),
  unidadMedidaId: z.string().min(1),
  proveedorPrincipalId: z.string().nullish(),
  imagenUrl: z.string().url().nullish(),
  controlaVencimiento: z.boolean().default(false),
  diasAvisoVencimiento: z.number().int().min(0).max(365).default(15),
  controlaLote: z.boolean().default(false),
  stockMinimo: z.number().min(0).default(0),
  puntoReposicion: z.number().min(0).default(0),
  stockMaximo: z.number().min(0).nullish(),
  activo: z.boolean().optional(),
});

const stockInicialSchema = z.object({
  almacenId: z.string().min(1, "Elegí un almacén para el stock inicial"),
  ubicacionId: z.string().nullish(),
  cantidad: z.number().positive(),
  costoUnitario: z.number().min(0).default(0),
  numeroLote: z.string().nullish(),
  fechaVencimiento: z.string().nullish(),
});

productsRouter.post(
  "/",
  requireAuth,
  requirePermiso("productos.editar"),
  asyncHandler(async (req, res) => {
    const { stockInicial, ...data } = createProductSchema
      .extend({ stockInicial: stockInicialSchema.nullish() })
      .parse(req.body);
    if (stockInicial && !req.auth!.permisos.includes("stock.registrar_movimiento")) {
      throw new HttpError(403, "No tenés permisos para cargar stock");
    }
    const producto = await productsService.createProduct(data, stockInicial ?? undefined, req.auth!.sub);
    res.status(201).json(producto);
  })
);

productsRouter.post(
  "/:id/imagen",
  requireAuth,
  requirePermiso("productos.editar"),
  productImageUpload.single("imagen"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Falta la imagen del producto");

    const ext = path.extname(req.file.originalname) || ".png";
    const nombreArchivo = `productos/${crypto.randomUUID()}${ext}`;
    const imagenUrl = await subirArchivoPublico(req.file.buffer, nombreArchivo, req.file.mimetype);
    const producto = await productsService.updateProduct(req.params.id, { imagenUrl });
    res.json(producto);
  })
);

const updateProductSchema = createProductSchema.partial();

productsRouter.put(
  "/:id",
  requireAuth,
  requirePermiso("productos.editar"),
  asyncHandler(async (req, res) => {
    const data = updateProductSchema.parse(req.body);
    const producto = await productsService.updateProduct(req.params.id, data);
    res.json(producto);
  })
);
