import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "@/config/env.js";
import { HttpError } from "@/lib/http-error.js";
import { revisarAlIngresar } from "@/jobs/expiry-check.job.js";

export interface AuthTokenPayload {
  sub: string;
  username: string;
  rolId: string;
  rolNombre: string;
  permisos: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "No autenticado");
  }

  const token = header.slice("Bearer ".length);
  try {
    req.auth = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
  } catch {
    throw new HttpError(401, "Token inválido o expirado");
  }
  // Primer uso del día (aunque la sesión haya quedado abierta y no haya
  // login): dispara la revisión diaria en segundo plano. Barato: compara fechas.
  revisarAlIngresar();
  next();
}

export function requirePermiso(...permisos: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const permisosUsuario = req.auth?.permisos ?? [];
    const tienePermiso = permisos.some((p) => permisosUsuario.includes(p));
    if (!tienePermiso) {
      throw new HttpError(403, "No tenés permisos para esta acción");
    }
    next();
  };
}
