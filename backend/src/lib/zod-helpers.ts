import { z } from "zod";

/**
 * z.coerce.boolean() usa el casting nativo de JS (Boolean("false") === true),
 * así que cualquier string no vacío —incluido "false"— se vuelve true. Este
 * helper interpreta correctamente "true"/"false" (para query params y .env).
 */
export const zBooleanFlexible = z.preprocess((val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val.toLowerCase() === "true";
  return val;
}, z.boolean());
