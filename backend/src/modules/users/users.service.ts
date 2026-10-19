import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma.js";
import { HttpError } from "@/lib/http-error.js";

export async function listUsers() {
  return prisma.usuario.findMany({
    orderBy: { nombreCompleto: "asc" },
    select: {
      id: true,
      nombreCompleto: true,
      username: true,
      email: true,
      activo: true,
      recibeAvisosVencimiento: true,
      idiomaPreferido: true,
      ultimoAcceso: true,
      createdAt: true,
      rol: { select: { id: true, nombre: true } },
    },
  });
}

export interface CreateUserInput {
  nombreCompleto: string;
  username: string;
  email?: string | null;
  password: string;
  rolId: string;
  recibeAvisosVencimiento?: boolean;
  idiomaPreferido?: "ES" | "EN";
}

export async function createUser(input: CreateUserInput) {
  const existente = await prisma.usuario.findUnique({ where: { username: input.username } });
  if (existente) {
    throw new HttpError(409, "Ya existe un usuario con ese nombre de usuario");
  }

  if (input.email) {
    const emailEnUso = await prisma.usuario.findUnique({ where: { email: input.email } });
    if (emailEnUso) {
      throw new HttpError(409, "Ya existe un usuario con ese email");
    }
  }

  const rol = await prisma.rol.findUnique({ where: { id: input.rolId } });
  if (!rol) {
    throw new HttpError(400, "El rol indicado no existe");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.usuario.create({
    data: {
      nombreCompleto: input.nombreCompleto,
      username: input.username,
      email: input.email || null,
      passwordHash,
      rolId: input.rolId,
      recibeAvisosVencimiento: input.recibeAvisosVencimiento ?? false,
      idiomaPreferido: input.idiomaPreferido,
    },
    select: {
      id: true,
      nombreCompleto: true,
      username: true,
      email: true,
      activo: true,
      recibeAvisosVencimiento: true,
      rol: { select: { id: true, nombre: true } },
    },
  });
}

export interface UpdateUserInput {
  nombreCompleto?: string;
  username?: string;
  email?: string | null;
  password?: string;
  rolId?: string;
  activo?: boolean;
  recibeAvisosVencimiento?: boolean;
  idiomaPreferido?: "ES" | "EN" | null;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  if (input.username && input.username !== usuario.username) {
    const existente = await prisma.usuario.findUnique({ where: { username: input.username } });
    if (existente) {
      throw new HttpError(409, "Ya existe un usuario con ese nombre de usuario");
    }
  }

  if (input.email && input.email !== usuario.email) {
    const emailEnUso = await prisma.usuario.findUnique({ where: { email: input.email } });
    if (emailEnUso) {
      throw new HttpError(409, "Ya existe un usuario con ese email");
    }
  }

  if (input.rolId) {
    const rol = await prisma.rol.findUnique({ where: { id: input.rolId } });
    if (!rol) {
      throw new HttpError(400, "El rol indicado no existe");
    }
  }

  return prisma.usuario.update({
    where: { id },
    data: {
      nombreCompleto: input.nombreCompleto,
      username: input.username,
      email: input.email,
      rolId: input.rolId,
      activo: input.activo,
      recibeAvisosVencimiento: input.recibeAvisosVencimiento,
      idiomaPreferido: input.idiomaPreferido,
      ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}),
    },
    select: {
      id: true,
      nombreCompleto: true,
      username: true,
      email: true,
      activo: true,
      recibeAvisosVencimiento: true,
      rol: { select: { id: true, nombre: true } },
    },
  });
}
