// Ejecuta un comando con las variables de otro archivo .env en lugar del
// .env de producción. Uso: node scripts/con-entorno.mjs .env.development <comando>
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import dotenv from "dotenv";

const [archivo, ...comando] = process.argv.slice(2);
if (!archivo || comando.length === 0 || !fs.existsSync(archivo)) {
  console.error(`Uso: node scripts/con-entorno.mjs <archivo .env existente> <comando>`);
  process.exit(1);
}

dotenv.config({ path: archivo, override: true });
// Para que "dotenv/config" del backend lea este archivo y no el .env.
process.env.DOTENV_CONFIG_PATH = archivo;

const resultado = spawnSync(comando.join(" "), { stdio: "inherit", shell: true, env: process.env });
process.exit(resultado.status ?? 1);
