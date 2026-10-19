import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { HttpError } from "@/lib/http-error.js";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth } from "@/middleware/auth.js";
import * as scanSessionsService from "./scan-sessions.service.js";

export const scanSessionsRouter = Router();

const fotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new HttpError(400, "El archivo tiene que ser una imagen"));
      return;
    }
    cb(null, true);
  },
});

// Crear/consultar/cerrar la sesión: lo hace la PC, ya autenticada.
scanSessionsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.status(201).json(scanSessionsService.crearSesion());
  })
);

scanSessionsRouter.get(
  "/:token",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ codigo: scanSessionsService.tomarSiguienteCodigo(req.params.token) });
  })
);

scanSessionsRouter.delete(
  "/:token",
  requireAuth,
  asyncHandler(async (req, res) => {
    scanSessionsService.eliminarSesion(req.params.token);
    res.status(204).end();
  })
);

// El celular manda el código: sin login, el token corto y de vida corta es
// lo único que hace falta (lo obtiene al escanear el QR mostrado en la PC).
const enviarCodigoSchema = z.object({ codigo: z.string().min(1) });

scanSessionsRouter.post(
  "/:token/codigo",
  asyncHandler(async (req, res) => {
    const { codigo } = enviarCodigoSchema.parse(req.body);
    scanSessionsService.agregarCodigo(req.params.token, codigo);
    res.status(204).end();
  })
);

// Foto del producto sacada con el celular: el celular la sube (sin login, con
// el token del QR) y la PC la levanta con polling.
scanSessionsRouter.post(
  "/:token/foto",
  fotoUpload.single("foto"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Falta la foto");
    scanSessionsService.guardarFoto(req.params.token, req.file.buffer, req.file.mimetype);
    res.status(204).end();
  })
);

scanSessionsRouter.get(
  "/:token/foto",
  requireAuth,
  asyncHandler(async (req, res) => {
    const foto = scanSessionsService.tomarFoto(req.params.token);
    if (!foto) {
      res.status(204).end();
      return;
    }
    res.setHeader("Content-Type", foto.mimetype);
    res.setHeader("Cache-Control", "no-store");
    res.send(foto.buffer);
  })
);
