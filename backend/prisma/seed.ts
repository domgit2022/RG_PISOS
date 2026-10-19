import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { subirArchivoPublico } from "../src/lib/supabase-storage.js";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PERMISOS = [
  "usuarios.gestionar",
  "configuracion.gestionar",
  "productos.editar",
  "productos.ver_costo",
  "precios.editar",
  "stock.registrar_movimiento",
  "ventas.registrar",
  "proveedores.gestionar",
  "reportes.ver",
  "datos.exportar",
  "datos.importar",
] as const;

const MATRIZ_ROL_PERMISOS: Record<string, string[]> = {
  Administrador: [...PERMISOS],
  "Encargado de depósito": [
    "productos.editar",
    "productos.ver_costo",
    "precios.editar",
    "stock.registrar_movimiento",
    "ventas.registrar",
    "proveedores.gestionar",
    "reportes.ver",
    "datos.exportar",
    "datos.importar",
  ],
  Vendedor: ["ventas.registrar", "reportes.ver"],
  "Solo lectura": ["reportes.ver", "datos.exportar"],
};

async function main() {
  const permisos = await Promise.all(
    PERMISOS.map((clave) =>
      prisma.permiso.upsert({
        where: { clave },
        update: {},
        create: { clave },
      })
    )
  );
  const permisoPorClave = new Map(permisos.map((p) => [p.clave, p.id]));

  for (const [nombre, claves] of Object.entries(MATRIZ_ROL_PERMISOS)) {
    const rol = await prisma.rol.upsert({
      where: { nombre },
      update: {},
      create: { nombre, esSistema: true },
    });

    await prisma.rolPermiso.deleteMany({ where: { rolId: rol.id } });
    await prisma.rolPermiso.createMany({
      data: claves.map((clave) => ({
        rolId: rol.id,
        permisoId: permisoPorClave.get(clave)!,
      })),
    });
  }

  // El primer usuario Administrador ya NO se crea acá: lo hace la pantalla
  // de arranque inicial (/setup) la primera vez que se abre el sistema sin
  // usuarios cargados, para que cada instalación elija su propio usuario y
  // contraseña en vez de depender de una credencial fija en el código.

  const almacen = await prisma.almacen.upsert({
    where: { id: "almacen-principal" },
    update: {},
    create: {
      id: "almacen-principal",
      nombre: "Depósito Principal",
      esPrincipal: true,
    },
  });
  await prisma.ubicacion.upsert({
    where: { id: "ubicacion-general" },
    update: {},
    create: {
      id: "ubicacion-general",
      almacenId: almacen.id,
      nombre: "General",
    },
  });

  const unidades: Array<[string, string, string]> = [
    ["UNIDAD", "Unidad", "Unit"],
    ["KG", "Kilogramo", "Kilogram"],
    ["GRAMO", "Gramo", "Gram"],
    ["LITRO", "Litro", "Liter"],
    ["ML", "Mililitro", "Milliliter"],
    ["CAJA", "Caja", "Box"],
    ["PAQUETE", "Paquete", "Pack"],
  ];
  for (const [codigo, nombreEs, nombreEn] of unidades) {
    await prisma.unidadMedida.upsert({
      where: { codigo },
      update: {},
      create: { codigo, nombre: nombreEs },
    });
    await prisma.traduccion.upsert({
      where: { namespace_clave_idioma: { namespace: "unidad_medida", clave: codigo, idioma: "EN" } },
      update: { valor: nombreEn },
      create: { namespace: "unidad_medida", clave: codigo, idioma: "EN", valor: nombreEn },
    });
  }

  const mediosPago: Array<[string, string]> = [
    ["Efectivo", "Cash"],
    ["Tarjeta de débito", "Debit card"],
    ["Tarjeta de crédito", "Credit card"],
    ["Transferencia bancaria", "Bank transfer"],
  ];
  for (const [nombreEs, nombreEn] of mediosPago) {
    await prisma.medioPago.upsert({
      where: { nombre: nombreEs },
      update: {},
      create: { nombre: nombreEs },
    });
    await prisma.traduccion.upsert({
      where: { namespace_clave_idioma: { namespace: "medio_pago", clave: nombreEs, idioma: "EN" } },
      update: { valor: nombreEn },
      create: { namespace: "medio_pago", clave: nombreEs, idioma: "EN", valor: nombreEn },
    });
  }

  await prisma.listaPrecio.upsert({
    where: { nombre: "Minorista" },
    update: {},
    create: { nombre: "Minorista", moneda: "ARS" },
  });
  await prisma.listaPrecio.upsert({
    where: { nombre: "Mayorista" },
    update: {},
    create: { nombre: "Mayorista", moneda: "ARS" },
  });

  const configExistente = await prisma.configuracion.findFirst();
  if (!configExistente) {
    await prisma.configuracion.create({
      data: {
        nombreComercial: "Mi Comercio",
        colorPrimario: "#00478D",
        colorSecundario: "#006A68",
        monedaPredeterminada: "ARS",
        diasAlertaVencimiento: 15,
        idiomaPredeterminado: "ES",
      },
    });
  }

  // Logo: se sube a Supabase Storage (no al disco local, que en producción
  // puede ser efímero). Si ya había un logo servido desde el disco local de
  // una versión anterior (rutas "/uploads/..."), se migra ESE mismo archivo
  // a Storage en vez de reemplazarlo por el genérico, para no perder un logo
  // ya personalizado por el administrador.
  const configActual = await prisma.configuracion.findFirst();
  if (configActual?.logoUrl?.startsWith("/uploads/")) {
    const nombreArchivo = path.basename(configActual.logoUrl);
    const rutaLocal = path.resolve(__dirname, "../uploads", nombreArchivo);
    const ext = path.extname(nombreArchivo).toLowerCase();
    const contentType =
      ext === ".svg" ? "image/svg+xml" : ext === ".webp" ? "image/webp" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
    const buffer = fs.existsSync(rutaLocal)
      ? fs.readFileSync(rutaLocal)
      : fs.readFileSync(path.join(__dirname, "seed-assets/logo-default.svg"));

    const logoUrl = await subirArchivoPublico(buffer, `migrado-${nombreArchivo}`, contentType);
    await prisma.configuracion.update({ where: { id: configActual.id }, data: { logoUrl } });
    console.log(`Logo migrado de disco local a Supabase Storage: ${logoUrl}`);
  } else if (configActual && !configActual.logoUrl) {
    const buffer = fs.readFileSync(path.join(__dirname, "seed-assets/logo-default.svg"));
    const logoUrl = await subirArchivoPublico(buffer, "logo-default.svg", "image/svg+xml");
    await prisma.configuracion.update({ where: { id: configActual.id }, data: { logoUrl } });
  }

  console.log("Seed completado.");
  const totalUsuarios = await prisma.usuario.count();
  if (totalUsuarios === 0) {
    console.log("No hay usuarios todavía: abrí el sistema en el navegador y vas a ver la pantalla de arranque inicial para crear el usuario administrador.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
