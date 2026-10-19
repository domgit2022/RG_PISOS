import { env } from "@/config/env.js";
import { prisma } from "@/lib/prisma.js";
import { sendMail, metodoDeEnvio } from "@/lib/mailer.js";
import { HttpError } from "@/lib/http-error.js";
import { listarLotesProximosAVencer, type LoteProximoAVencer } from "@/lib/vencimientos.js";
import { productosStockBajo, type ProductoStockBajo } from "@/modules/reports/reports.service.js";

/**
 * Roles "responsables" de stock (spec sección 6: alertas a los usuarios
 * responsables) son los que tienen permiso para registrar movimientos, es
 * decir Administrador y Encargado de depósito.
 */
const PERMISO_RESPONSABLE_STOCK = "stock.registrar_movimiento";

async function getDestinatariosStockBajo() {
  const usuarios = await prisma.usuario.findMany({
    where: {
      activo: true,
      email: { not: null },
      rol: { permisos: { some: { permiso: { clave: PERMISO_RESPONSABLE_STOCK } } } },
    },
    select: { email: true },
  });
  return usuarios.map((u) => u.email).filter((email): email is string => Boolean(email));
}

/**
 * A diferencia de las alertas de stock bajo, quién recibe el recordatorio de
 * vencimientos no depende del rol/permiso sino de un tilde por usuario
 * (Usuario.recibeAvisosVencimiento), que se configura al crear o editar cada
 * usuario sin importar qué rol tenga.
 */
async function getDestinatariosVencimiento() {
  const usuarios = await prisma.usuario.findMany({
    where: { activo: true, email: { not: null }, recibeAvisosVencimiento: true },
    select: { email: true },
  });
  return usuarios.map((u) => u.email).filter((email): email is string => Boolean(email));
}

function construirCorreo(producto: {
  nombre: string;
  sku: string;
  stockActual: number;
  puntoReposicion: number;
  proveedorPrincipal: { nombre: string; telefono: string | null; email: string | null } | null;
}) {
  const proveedorTexto = producto.proveedorPrincipal
    ? `${producto.proveedorPrincipal.nombre}${
        producto.proveedorPrincipal.telefono ? ` — Tel: ${producto.proveedorPrincipal.telefono}` : ""
      }${producto.proveedorPrincipal.email ? ` — Email: ${producto.proveedorPrincipal.email}` : ""}`
    : "Sin proveedor principal asignado";

  const subject = `Alerta de stock bajo: ${producto.nombre} (${producto.sku})`;
  const text = [
    `El producto "${producto.nombre}" (Material ${producto.sku}) llegó a su punto de reposición.`,
    ``,
    `Stock actual: ${producto.stockActual}`,
    `Punto de reposición: ${producto.puntoReposicion}`,
    `Proveedor principal: ${proveedorTexto}`,
  ].join("\n");
  const html = `
    <p>El producto <strong>${producto.nombre}</strong> (Material ${producto.sku}) llegó a su punto de reposición.</p>
    <ul>
      <li><strong>Stock actual:</strong> ${producto.stockActual}</li>
      <li><strong>Punto de reposición:</strong> ${producto.puntoReposicion}</li>
      <li><strong>Proveedor principal:</strong> ${proveedorTexto}</li>
    </ul>
  `;

  return { subject, text, html };
}

export async function verificarPuntosDeReposicion() {
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    include: {
      lotes: { select: { cantidadActual: true } },
      proveedorPrincipal: { select: { nombre: true, telefono: true, email: true } },
      alertas: { where: { tipo: "STOCK_BAJO", estado: "PENDIENTE" } },
    },
  });

  const destinatarios = await getDestinatariosStockBajo();

  let alertasCreadas = 0;
  let alertasResueltas = 0;

  for (const producto of productos) {
    const stockActual = producto.lotes.reduce((acc, l) => acc + Number(l.cantidadActual), 0);
    const puntoReposicion = Number(producto.puntoReposicion);
    const aReponer = stockActual <= puntoReposicion;
    const alertaPendiente = producto.alertas[0];

    if (aReponer && !alertaPendiente) {
      await prisma.alerta.create({
        data: {
          tipo: "STOCK_BAJO",
          productoId: producto.id,
          nivelUrgencia: stockActual <= 0 ? "CRITICO" : "ADVERTENCIA",
        },
      });
      alertasCreadas += 1;

      const correo = construirCorreo({
        nombre: producto.nombre,
        sku: producto.sku,
        stockActual,
        puntoReposicion,
        proveedorPrincipal: producto.proveedorPrincipal,
      });
      await sendMail({ to: destinatarios, ...correo });
    } else if (!aReponer && alertaPendiente) {
      await prisma.alerta.update({
        where: { id: alertaPendiente.id },
        data: { estado: "RESUELTA", fechaResolucion: new Date() },
      });
      alertasResueltas += 1;
    }
  }

  return { productosRevisados: productos.length, alertasCreadas, alertasResueltas };
}

function seccionVencimientos(lotes: LoteProximoAVencer[]) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const filas = lotes.map((l) => {
    const proveedorTexto = l.producto.proveedorPrincipal?.nombre ?? "Sin proveedor principal asignado";
    const fecha = l.fechaVencimiento.toLocaleDateString("es-AR");
    const diasRestantes = Math.round((l.fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    const vencimientoTexto = diasRestantes < 0 ? `${fecha} (vencido)` : `${fecha} (en ${diasRestantes} día${diasRestantes === 1 ? "" : "s"})`;
    return { ...l, proveedorTexto, vencimientoTexto };
  });

  const text = [
    `PRODUCTOS CON VENCIMIENTO PRÓXIMO O VENCIDOS:`,
    ``,
    ...filas.map(
      (f) =>
        `- ${f.producto.nombre} (Material ${f.producto.sku})${f.numeroLote ? ` — Lote ${f.numeroLote}` : ""}\n` +
        `  Stock actual: ${f.stockActual} | Mínimo: ${f.producto.stockMinimo} | Máximo: ${f.producto.stockMaximo ?? "—"} | Pto. reposición: ${f.producto.puntoReposicion}\n` +
        `  Vencimiento: ${f.vencimientoTexto} | Proveedor: ${f.proveedorTexto}`
    ),
  ].join("\n");

  const filasHtml = filas
    .map(
      (f) => `
      <tr>
        <td>${f.producto.nombre} (${f.producto.sku})${f.numeroLote ? `<br/><small>Lote ${f.numeroLote}</small>` : ""}</td>
        <td>${f.stockActual}</td>
        <td>${f.producto.stockMinimo}</td>
        <td>${f.producto.stockMaximo ?? "—"}</td>
        <td>${f.producto.puntoReposicion}</td>
        <td>${f.vencimientoTexto}</td>
        <td>${f.proveedorTexto}</td>
      </tr>`
    )
    .join("");

  const html = `
    <h3>Productos con vencimiento próximo o vencidos</h3>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr>
          <th>Producto</th>
          <th>Stock actual</th>
          <th>Stock mínimo</th>
          <th>Stock máximo</th>
          <th>Pto. reposición</th>
          <th>Vencimiento</th>
          <th>Proveedor</th>
        </tr>
      </thead>
      <tbody>${filasHtml}</tbody>
    </table>
  `;

  return { text, html };
}

function seccionStockBajo(productos: ProductoStockBajo[]) {
  const text = [
    `PRODUCTOS CON STOCK BAJO (en o por debajo del punto de reposición):`,
    ``,
    ...productos.map(
      (p) => `- ${p.nombre} (Material ${p.sku}) — Categoría: ${p.categoria}\n  Stock actual: ${p.stockActual} | Pto. reposición: ${p.puntoReposicion}`
    ),
  ].join("\n");

  const filasHtml = productos
    .map(
      (p) => `
      <tr>
        <td>${p.nombre} (${p.sku})</td>
        <td>${p.categoria}</td>
        <td>${p.stockActual}</td>
        <td>${p.puntoReposicion}</td>
      </tr>`
    )
    .join("");

  const html = `
    <h3>Productos con stock bajo</h3>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr>
          <th>Producto</th>
          <th>Categoría</th>
          <th>Stock actual</th>
          <th>Pto. reposición</th>
        </tr>
      </thead>
      <tbody>${filasHtml}</tbody>
    </table>
  `;

  return { text, html };
}

function construirInformeDiario(lotes: LoteProximoAVencer[], stockBajo: ProductoStockBajo[]) {
  const subject = "Reporte de Productos";

  const partesText: string[] = [];
  const partesHtml: string[] = [];

  if (lotes.length > 0) {
    const seccion = seccionVencimientos(lotes);
    partesText.push(seccion.text);
    partesHtml.push(seccion.html);
  }
  if (stockBajo.length > 0) {
    const seccion = seccionStockBajo(stockBajo);
    partesText.push(seccion.text);
    partesHtml.push(seccion.html);
  }

  return { subject, text: partesText.join("\n\n"), html: partesHtml.join("<hr/>") };
}

/**
 * Días calendario mínimos entre dos envíos efectivos del informe, según la
 * frecuencia elegida en Configuración. El job igual corre todos los días (ver
 * expiry-check.job); esta función es la que decide si, dado cuándo se envió
 * la última vez, ya corresponde volver a enviarlo. Se cuentan días
 * calendario en APP_TIMEZONE y no horas, para que un disparo unos minutos
 * más temprano que el anterior no corra el envío al día siguiente; DIARIO
 * vale 1 para no mandar dos informes el mismo día.
 */
const DIAS_MINIMOS_POR_FRECUENCIA: Record<string, number> = {
  DIARIO: 1,
  SEMANAL: 7,
  QUINCENAL: 15,
  MENSUAL: 30,
};

const MS_POR_DIA = 1000 * 60 * 60 * 24;

function diaCalendario(fecha: Date): number {
  const [anio, mes, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(fecha)
    .split("-")
    .map(Number);
  return Date.UTC(anio, mes - 1, dia) / MS_POR_DIA;
}

function corresponeEnviarSegunFrecuencia(frecuencia: string, ultimoEnvio: Date | null): boolean {
  if (!ultimoEnvio) return true;
  const diasMinimos = DIAS_MINIMOS_POR_FRECUENCIA[frecuencia] ?? 1;
  return diaCalendario(new Date()) - diaCalendario(ultimoEnvio) >= diasMinimos;
}

/**
 * Revisión diaria de vencimientos próximos y stock bajo, consolidada en un
 * único mail (spec: informe a los usuarios marcados para recibirlo, ver
 * Usuario.recibeAvisosVencimiento). El umbral de "próximo a vencer" es por
 * producto (Producto.diasAvisoVencimiento), no global, para que cada
 * material pueda anticiparse según su propia rotación. Se incluyen también
 * los lotes ya vencidos que todavía tengan stock, porque siguen requiriendo
 * acción.
 *
 * La cadencia del envío (diario, semanal, quincenal o mensual) se configura
 * en Configuración.frecuenciaInformeVencimientos: el job corre todos los
 * días, pero solo manda el mail cuando ya pasó el intervalo configurado
 * desde el último envío efectivo. Si no hay nada para reportar ese día, no
 * se actualiza la fecha de "último envío", para no saltear el próximo
 * período apenas aparezca contenido.
 */
export async function verificarVencimientosProximos() {
  const config = await prisma.configuracion.findFirst();

  const [{ lotes: lotesAVencer, productosRevisados }, stockBajo] = await Promise.all([
    listarLotesProximosAVencer(),
    productosStockBajo(),
  ]);

  const hayContenido = lotesAVencer.length > 0 || stockBajo.length > 0;
  const corresponde =
    !config || corresponeEnviarSegunFrecuencia(config.frecuenciaInformeVencimientos, config.ultimoEnvioInformeVencimientos);

  let enviado = false;
  if (hayContenido && corresponde) {
    const destinatarios = await getDestinatariosVencimiento();
    if (destinatarios.length === 0) {
      return { productosRevisados, lotesAVencer: lotesAVencer.length, productosStockBajo: stockBajo.length, enviado };
    }

    // Se "reserva" el envío antes de mandar el mail, con un update
    // condicionado al último envío leído: si el cron interno y el externo
    // disparan a la vez, solo uno de los dos logra actualizar y manda.
    if (config) {
      const reserva = await prisma.configuracion.updateMany({
        where: { id: config.id, ultimoEnvioInformeVencimientos: config.ultimoEnvioInformeVencimientos },
        data: { ultimoEnvioInformeVencimientos: new Date() },
      });
      if (reserva.count === 0) {
        return { productosRevisados, lotesAVencer: lotesAVencer.length, productosStockBajo: stockBajo.length, enviado };
      }
    }

    const correo = construirInformeDiario(lotesAVencer, stockBajo);
    try {
      await sendMail({ to: destinatarios, ...correo });
    } catch (error) {
      if (config) {
        await prisma.configuracion.update({
          where: { id: config.id },
          data: { ultimoEnvioInformeVencimientos: config.ultimoEnvioInformeVencimientos },
        });
      }
      throw error;
    }
    enviado = true;
  }

  return { productosRevisados, lotesAVencer: lotesAVencer.length, productosStockBajo: stockBajo.length, enviado };
}

export async function listAlerts() {
  return prisma.alerta.findMany({
    orderBy: { fechaCreacion: "desc" },
    take: 200,
    include: {
      producto: { select: { id: true, nombre: true, sku: true } },
    },
  });
}

const enmascarar = (email: string) => email.replace(/^(.{1,2}).*(@.*)$/, "$1***$2");

const mensajeDe = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 400);

/** Corre un paso del diagnóstico sin que su falla tape a los demás. */
async function paso<T>(fn: () => Promise<T>): Promise<{ ok: true; valor: T } | { ok: false; error: string }> {
  try {
    return { ok: true, valor: await fn() };
  } catch (error) {
    console.error("[diagnostico-mail]", error);
    return { ok: false, error: mensajeDe(error) };
  }
}

/**
 * Estado del envío del informe, para diagnosticar desde Configuración por qué
 * no llega: método de envío configurado, destinatarios, si hay contenido y si
 * ya corresponde según la frecuencia. Cada paso informa su propio error.
 */
export async function diagnosticoMail() {
  const [config, lotes, stockBajo, destinatarios] = await Promise.all([
    paso(() => prisma.configuracion.findFirst()),
    paso(async () => (await listarLotesProximosAVencer()).lotes.length),
    paso(async () => (await productosStockBajo()).length),
    paso(async () => (await getDestinatariosVencimiento()).map(enmascarar)),
  ]);
  const cfg = config.ok ? config.valor : null;
  return {
    metodo: metodoDeEnvio(),
    destinatarios: destinatarios.ok ? destinatarios.valor : [],
    lotesAVencer: lotes.ok ? lotes.valor : 0,
    productosStockBajo: stockBajo.ok ? stockBajo.valor : 0,
    frecuencia: cfg?.frecuenciaInformeVencimientos ?? null,
    ultimoEnvio: cfg?.ultimoEnvioInformeVencimientos ?? null,
    correspondeHoy: !cfg || corresponeEnviarSegunFrecuencia(cfg.frecuenciaInformeVencimientos, cfg.ultimoEnvioInformeVencimientos),
    errores: {
      configuracion: config.ok ? null : config.error,
      vencimientos: lotes.ok ? null : lotes.error,
      stockBajo: stockBajo.ok ? null : stockBajo.error,
      destinatarios: destinatarios.ok ? null : destinatarios.error,
    },
  };
}

/**
 * Manda el informe ahora a los destinatarios, sin mirar la frecuencia ni
 * tocar la fecha del último envío (es una prueba). Si no hay contenido, manda
 * igual un mail corto de prueba para verificar que el envío funciona. Ante
 * cualquier falla devuelve el mensaje real, para poder diagnosticarla.
 */
export async function enviarInformePrueba() {
  let etapa = "leer los destinatarios";
  try {
    const destinatarios = await getDestinatariosVencimiento();
    if (destinatarios.length === 0) {
      throw new HttpError(400, "No hay usuarios activos con email y la opción de recibir avisos activada.");
    }
    etapa = "armar el informe";
    const [{ lotes }, stockBajo] = await Promise.all([listarLotesProximosAVencer(), productosStockBajo()]);
    const conContenido = lotes.length > 0 || stockBajo.length > 0;
    const correo = conContenido
      ? construirInformeDiario(lotes, stockBajo)
      : {
          subject: "Prueba de envío - RG Pisos",
          text: "Este es un mail de prueba: el envío de informes funciona. Hoy no hay vencimientos próximos ni stock bajo.",
          html: "<p>Este es un mail de prueba: el envío de informes funciona.</p><p>Hoy no hay vencimientos próximos ni stock bajo.</p>",
        };
    etapa = "enviar el mail";
    await sendMail({ to: destinatarios, ...correo });
    return { enviadoA: destinatarios.map(enmascarar), conContenido };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("[enviar-informe-prueba]", error);
    throw new HttpError(502, `Falló al ${etapa}: ${mensajeDe(error)}`);
  }
}
