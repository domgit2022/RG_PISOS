import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/lib/prisma.js";
import { asyncHandler } from "@/middleware/error-handler.js";
import { requireAuth, requirePermiso } from "@/middleware/auth.js";

/**
 * Traducciones administrables de campos de negocio (unidades de medida, medios
 * de pago, categorías, etc). Los textos fijos de la interfaz se resuelven en
 * el frontend con i18next; esto es para contenido que carga el propio negocio.
 */
export const translationsRouter = Router();

translationsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const namespace = typeof req.query.namespace === "string" ? req.query.namespace : undefined;
    res.json(
      await prisma.traduccion.findMany({
        where: namespace ? { namespace } : undefined,
        orderBy: [{ namespace: "asc" }, { clave: "asc" }],
      })
    );
  })
);

const upsertSchema = z.object({
  namespace: z.string().min(1),
  clave: z.string().min(1),
  idioma: z.enum(["ES", "EN"]),
  valor: z.string().min(1),
});

translationsRouter.put(
  "/",
  requireAuth,
  requirePermiso("configuracion.gestionar"),
  asyncHandler(async (req, res) => {
    const { namespace, clave, idioma, valor } = upsertSchema.parse(req.body);
    const traduccion = await prisma.traduccion.upsert({
      where: { namespace_clave_idioma: { namespace, clave, idioma } },
      update: { valor },
      create: { namespace, clave, idioma, valor },
    });
    res.json(traduccion);
  })
);
