// El cliente de Prisma se genera en src/generated/prisma (archivos .js ya
// compilados + el binario nativo del motor). tsc no copia nada que no sea
// .ts, así que después de compilar hay que llevar esa carpeta a dist/ a
// mano para que las rutas relativas del código compilado la encuentren.
import fs from "node:fs";
import path from "node:path";

const origen = path.resolve(import.meta.dirname, "../src/generated");
const destino = path.resolve(import.meta.dirname, "../dist/generated");

fs.cpSync(origen, destino, { recursive: true });
console.log(`Cliente de Prisma copiado a ${destino}`);
