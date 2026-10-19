import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { Prisma } from "../generated/prisma/index.js";
import { HttpError } from "@/lib/http-error.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Recurso no encontrado" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Datos inválidos", details: err.flatten() });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "La imagen es demasiado grande. El tamaño máximo permitido es 5MB." });
      return;
    }
    res.status(400).json({ error: "No se pudo subir el archivo" });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const campos = (err.meta?.target as string[] | undefined)?.join(", ") ?? "un campo único";
      res.status(409).json({ error: `Ya existe un registro con ese valor en: ${campos}` });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Registro no encontrado" });
      return;
    }
    if (err.code === "P2003") {
      res.status(409).json({ error: "No se puede completar la operación: hay registros relacionados" });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
}

export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(
  fn: T
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
