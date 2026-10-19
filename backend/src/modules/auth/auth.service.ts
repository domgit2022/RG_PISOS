import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma.js";
import { env } from "@/config/env.js";
import { HttpError } from "@/lib/http-error.js";
import type { AuthTokenPayload } from "@/middleware/auth.js";

export async function login(username: string, password: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { username },
    include: { rol: { include: { permisos: { include: { permiso: true } } } } },
  });

  if (!usuario || !usuario.activo) {
    throw new HttpError(401, "Credenciales inválidas");
  }

  const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordValida) {
    throw new HttpError(401, "Credenciales inválidas");
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAcceso: new Date() },
  });

  const payload: AuthTokenPayload = {
    sub: usuario.id,
    username: usuario.username,
    rolId: usuario.rolId,
    rolNombre: usuario.rol.nombre,
    permisos: usuario.rol.permisos.map((rp) => rp.permiso.clave),
  };

  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });

  return {
    token,
    usuario: {
      id: usuario.id,
      nombreCompleto: usuario.nombreCompleto,
      username: usuario.username,
      rol: usuario.rol.nombre,
      idiomaPreferido: usuario.idiomaPreferido,
      permisos: payload.permisos,
    },
  };
}
