// Copia de seguridad de la base de PRODUCCIÓN (la del .env) con pg_dump.
// Deja un archivo .dump en backend/backups (o en BACKUP_DIR) y conserva los
// últimos BACKUP_CONSERVAR (30 por defecto).
// Restaurar: pg_restore --clean --if-exists -d <url> <archivo.dump>
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const pgBin = process.env.PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
const carpeta = path.resolve(process.env.BACKUP_DIR ?? "backups");
const conservar = Number(process.env.BACKUP_CONSERVAR ?? 30);
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL en el .env");
  process.exit(1);
}

const base = new URL(url).pathname.slice(1);
// Hora local (formato sv-SE = AAAA-MM-DD HH:MM), no UTC.
const fecha = new Date().toLocaleString("sv-SE").slice(0, 16).replace(/[-:]/g, "").replace(" ", "_");
fs.mkdirSync(carpeta, { recursive: true });
const archivo = path.join(carpeta, `${base}_${fecha}.dump`);

const r = spawnSync(path.join(pgBin, "pg_dump"), ["--format=custom", `--file=${archivo}`, `--dbname=${url}`], {
  stdio: "inherit",
});
if (r.status !== 0) {
  console.error("Falló el backup");
  process.exit(r.status ?? 1);
}
console.log(`Backup guardado en ${archivo}`);

const viejos = fs
  .readdirSync(carpeta)
  .filter((f) => f.startsWith(`${base}_`) && f.endsWith(".dump"))
  .sort()
  .slice(0, -conservar);
for (const f of viejos) fs.unlinkSync(path.join(carpeta, f));
