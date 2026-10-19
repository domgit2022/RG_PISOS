import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/middleware/error-handler.js";
import * as setupService from "./setup.service.js";

export const setupRouter = Router();

setupRouter.get(
  "/estado",
  asyncHandler(async (_req, res) => {
    res.json({ requiereSetup: await setupService.requiereSetup() });
  })
);

const inicializarSchema = z.object({
  nombreComercial: z.string().min(1),
  nombreCompleto: z.string().min(1),
  username: z
    .string()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(32)
    .regex(/^[a-z0-9._-]+$/, "Solo minúsculas, números, puntos, guiones y guiones bajos"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

setupRouter.post(
  "/inicializar",
  asyncHandler(async (req, res) => {
    const data = inicializarSchema.parse(req.body);
    res.status(201).json(await setupService.inicializar(data));
  })
);
