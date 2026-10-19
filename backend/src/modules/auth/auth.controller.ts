import type { Request, Response } from "express";
import { z } from "zod";
import * as authService from "./auth.service.js";
import { prisma } from "@/lib/prisma.js";
import { HttpError } from "@/lib/http-error.js";
import { revisarAlIngresar } from "@/jobs/expiry-check.job.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function postLogin(req: Request, res: Response) {
  const { username, password } = loginSchema.parse(req.body);
  const resultado = await authService.login(username, password);
  res.json(resultado);
  revisarAlIngresar();
}

export async function getMe(req: Request, res: Response) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.auth!.sub },
    select: {
      id: true,
      nombreCompleto: true,
      username: true,
      idiomaPreferido: true,
      rol: { select: { nombre: true } },
    },
  });
  if (!usuario) throw new HttpError(404, "Usuario no encontrado");
  res.json({ ...usuario, permisos: req.auth!.permisos });
}
