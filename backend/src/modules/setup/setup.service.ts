import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Prisma } from "../../generated/prisma/index.js";
import { prisma } from "@/lib/prisma.js";
import { env } from "@/config/env.js";
import { HttpError } from "@/lib/http-error.js";
import type { AuthTokenPayload } from "@/middleware/auth.js";

type Db = typeof prisma | Prisma.TransactionClient;

export async function requiereSetup(db: Db = prisma) {
  const totalUsuarios = await db.usuario.count();
  return totalUsuarios === 0;
}

export interface InicializarInput {
  nombreComercial: string;
  nombreCompleto: string;
  username: string;
  password: string;
}

/**
 * Bootstrap del primer usuario Administrador para una instalación nueva.
 * Requiere que `npm run seed` ya se haya corrido (crea los roles y la fila
 * de Configuracion); esto solo resuelve "quién es la primera persona que
 * entra", no reemplaza la migración/seed inicial de infraestructura.
 */
export async function inicializar(input: InicializarInput, db: Db = prisma) {
  const totalUsuarios = await db.usuario.count();
  if (totalUsuarios > 0) {
    throw new HttpError(409, "El sistema ya tiene usuarios creados; el arranque inicial ya no está disponible");
  }

  const rolAdmin = await db.rol.findUnique({ where: { nombre: "Administrador" } });
  if (!rolAdmin) {
    throw new HttpError(
      500,
      "Falta inicializar la base (roles). Corré la migración y 'npm run seed' en el backend antes de este paso."
    );
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const usuario = await db.usuario.create({
    data: {
      nombreCompleto: input.nombreCompleto,
      username: input.username,
      passwordHash,
      rolId: rolAdmin.id,
    },
  });

  const config = await db.configuracion.findFirst();
  if (config) {
    await db.configuracion.update({ where: { id: config.id }, data: { nombreComercial: input.nombreComercial } });
  } else {
    await db.configuracion.create({ data: { nombreComercial: input.nombreComercial } });
  }

  const permisos = await db.rolPermiso.findMany({ where: { rolId: rolAdmin.id }, include: { permiso: true } });
  const payload: AuthTokenPayload = {
    sub: usuario.id,
    username: usuario.username,
    rolId: rolAdmin.id,
    rolNombre: rolAdmin.nombre,
    permisos: permisos.map((p) => p.permiso.clave),
  };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });

  return {
    token,
    usuario: {
      id: usuario.id,
      nombreCompleto: usuario.nombreCompleto,
      username: usuario.username,
      rol: rolAdmin.nombre,
      idiomaPreferido: usuario.idiomaPreferido,
      permisos: payload.permisos,
    },
  };
}
