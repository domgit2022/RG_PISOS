import { Router } from "express";
import { prisma } from "@/lib/prisma.js";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";

export const rolesRouter = Router();

rolesRouter.get(
  "/",
  requireAuth,
  requirePermiso("usuarios.gestionar"),
  asyncHandler(async (_req, res) => {
    res.json(await prisma.rol.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }));
  })
);
