import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";
import * as usersService from "./users.service.js";

export const usersRouter = Router();

usersRouter.get(
  "/",
  requireAuth,
  requirePermiso("usuarios.gestionar"),
  asyncHandler(async (_req, res) => {
    res.json(await usersService.listUsers());
  })
);

const createUserSchema = z.object({
  nombreCompleto: z.string().min(1),
  username: z
    .string()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(32)
    .regex(/^[a-z0-9._-]+$/, "Solo minúsculas, números, puntos, guiones y guiones bajos"),
  email: z.string().email().nullish(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  rolId: z.string().min(1),
  recibeAvisosVencimiento: z.boolean().default(false),
  idiomaPreferido: z.enum(["ES", "EN"]).optional(),
});

usersRouter.post(
  "/",
  requireAuth,
  requirePermiso("usuarios.gestionar"),
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body);
    const usuario = await usersService.createUser(data);
    res.status(201).json(usuario);
  })
);

const updateUserSchema = z.object({
  nombreCompleto: z.string().min(1).optional(),
  username: z
    .string()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(32)
    .regex(/^[a-z0-9._-]+$/, "Solo minúsculas, números, puntos, guiones y guiones bajos")
    .optional(),
  email: z.string().email().nullish(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").optional(),
  rolId: z.string().min(1).optional(),
  activo: z.boolean().optional(),
  recibeAvisosVencimiento: z.boolean().optional(),
  idiomaPreferido: z.enum(["ES", "EN"]).nullish(),
});

usersRouter.put(
  "/:id",
  requireAuth,
  requirePermiso("usuarios.gestionar"),
  asyncHandler(async (req, res) => {
    const data = updateUserSchema.parse(req.body);
    const usuario = await usersService.updateUser(req.params.id, data);
    res.json(usuario);
  })
);
