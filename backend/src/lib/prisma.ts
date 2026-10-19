import { PrismaClient } from "../generated/prisma/index.js";
import { env } from "@/config/env.js";

/**
 * El pooler de Supabase en modo transacción (puerto 6543, PgBouncer) no
 * soporta los "prepared statements" que Prisma usa por defecto: sin
 * `pgbouncer=true` las consultas fallan de forma intermitente con
 * `prepared statement "sN" does not exist` (la app venía sin datos, el
 * informe por mail no salía). Si la URL apunta al pooler y no lo trae, se
 * agrega acá para no depender de cómo esté cargada la variable en el hosting.
 */
function urlConPgbouncer(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.port === "6543" && parsed.searchParams.get("pgbouncer") !== "true") {
      // Se agrega al final (sin reserializar) para no alterar la contraseña.
      return `${url}${url.includes("?") ? "&" : "?"}pgbouncer=true`;
    }
  } catch {
    // URL no parseable: se usa tal cual.
  }
  return url;
}

export const prisma = new PrismaClient({
  datasourceUrl: urlConPgbouncer(env.DATABASE_URL),
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
