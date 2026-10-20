import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "@/lib/prisma.js";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";
import { HttpError } from "@/lib/http-error.js";
import { subirArchivoPublico } from "@/lib/storage.js";
import { diagnosticoMail, enviarInformePrueba } from "@/modules/alerts/alerts.service.js";

export const settingsRouter = Router();

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.mimetype)) {
      cb(new HttpError(400, "Formato de imagen no soportado (usá PNG, JPG, SVG o WEBP)"));
      return;
    }
    cb(null, true);
  },
});

/**
 * Sin autenticación a propósito: el login y el layout necesitan poder pintar
 * el logo, el nombre comercial y los colores de marca ANTES de que la
 * persona inicie sesión. Solo expone datos de marca, nunca contacto/costos.
 */
settingsRouter.get(
  "/publica",
  asyncHandler(async (_req, res) => {
    const config = await prisma.configuracion.findFirst();
    if (!config) throw new HttpError(404, "Configuración no inicializada");
    res.json({
      nombreComercial: config.nombreComercial,
      logoUrl: config.logoUrl,
      colorPrimario: config.colorPrimario,
      colorSecundario: config.colorSecundario,
      idiomaPredeterminado: config.idiomaPredeterminado,
    });
  })
);

settingsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const config = await prisma.configuracion.findFirst();
    if (!config) throw new HttpError(404, "Configuración no inicializada");
    res.json(config);
  })
);

const updateSettingsSchema = z.object({
  nombreComercial: z.string().min(1).optional(),
  razonSocial: z.string().nullish(),
  logoUrl: z.string().url().nullish(),
  colorPrimario: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  colorSecundario: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  direccion: z.string().nullish(),
  telefono: z.string().nullish(),
  email: z.string().email().nullish(),
  monedaPredeterminada: z.enum(["ARS", "USD", "EUR"]).optional(),
  formatoFecha: z.string().optional(),
  diasAlertaVencimiento: z.number().int().min(1).max(365).optional(),
  frecuenciaInformeVencimientos: z.enum(["DIARIO", "SEMANAL", "QUINCENAL", "MENSUAL"]).optional(),
  idiomaPredeterminado: z.enum(["ES", "EN"]).optional(),
});

settingsRouter.put(
  "/",
  requireAuth,
  requirePermiso("configuracion.gestionar"),
  asyncHandler(async (req, res) => {
    const data = updateSettingsSchema.parse(req.body);
    const config = await prisma.configuracion.findFirst();
    if (!config) throw new HttpError(404, "Configuración no inicializada");
    const actualizada = await prisma.configuracion.update({ where: { id: config.id }, data });
    res.json(actualizada);
  })
);

settingsRouter.post(
  "/logo",
  requireAuth,
  requirePermiso("configuracion.gestionar"),
  logoUpload.single("logo"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Falta el archivo de logo");
    const config = await prisma.configuracion.findFirst();
    if (!config) throw new HttpError(404, "Configuración no inicializada");

    const ext = path.extname(req.file.originalname) || ".png";
    const nombreArchivo = `logo-${crypto.randomUUID()}${ext}`;
    const logoUrl = await subirArchivoPublico(req.file.buffer, nombreArchivo, req.file.mimetype);

    const actualizada = await prisma.configuracion.update({ where: { id: config.id }, data: { logoUrl } });
    res.json(actualizada);
  })
);

settingsRouter.get(
  "/diagnostico-mail",
  requireAuth,
  requirePermiso("configuracion.gestionar"),
  asyncHandler(async (_req, res) => {
    res.json(await diagnosticoMail());
  })
);

settingsRouter.post(
  "/enviar-informe-prueba",
  requireAuth,
  requirePermiso("configuracion.gestionar"),
  asyncHandler(async (_req, res) => {
    res.json(await enviarInformePrueba());
  })
);
