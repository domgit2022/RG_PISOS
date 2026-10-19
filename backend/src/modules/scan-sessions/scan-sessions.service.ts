import crypto from "node:crypto";
import { HttpError } from "@/lib/http-error.js";

/**
 * Vinculación celular↔PC para escanear códigos de barras: la PC crea una
 * sesión y muestra un QR con el link; el celular (sin necesidad de login)
 * escanea con su cámara y manda los códigos a esa sesión; la PC los va
 * consumiendo con polling. Todo en memoria: son sesiones cortas y
 * descartables, no hace falta persistirlas en la base.
 */
interface SesionEscaneo {
  cola: string[];
  /** Última foto sacada con el celular, pendiente de que la PC la levante. */
  foto: { buffer: Buffer; mimetype: string } | null;
  expiraEn: number;
}

const TTL_MS = 20 * 60 * 1000; // 20 min de inactividad
const TTL_MAXIMO_MS = 2 * 60 * 60 * 1000; // tope duro: 2hs desde la creación
const MAX_COLA = 50;
const MAX_LARGO_CODIGO = 128;

const sesiones = new Map<string, SesionEscaneo>();
const creadaEn = new Map<string, number>();

function purgarExpiradas() {
  const ahora = Date.now();
  for (const [token, sesion] of sesiones) {
    if (sesion.expiraEn < ahora) {
      sesiones.delete(token);
      creadaEn.delete(token);
    }
  }
}
setInterval(purgarExpiradas, 60 * 1000).unref();

export function crearSesion() {
  const token = crypto.randomBytes(24).toString("base64url");
  const ahora = Date.now();
  sesiones.set(token, { cola: [], foto: null, expiraEn: ahora + TTL_MS });
  creadaEn.set(token, ahora);
  return { token, expiraEn: ahora + TTL_MS };
}

function obtenerSesionViva(token: string): SesionEscaneo | null {
  const sesion = sesiones.get(token);
  if (!sesion || sesion.expiraEn < Date.now()) {
    sesiones.delete(token);
    creadaEn.delete(token);
    return null;
  }
  return sesion;
}

export function agregarCodigo(token: string, codigo: string) {
  const sesion = obtenerSesionViva(token);
  if (!sesion) throw new HttpError(404, "La sesión de escaneo no existe o expiró");

  const limpio = codigo.trim().slice(0, MAX_LARGO_CODIGO);
  if (!limpio) throw new HttpError(400, "Código vacío");
  if (sesion.cola.length >= MAX_COLA) throw new HttpError(429, "Demasiados códigos pendientes de leer en la PC");

  sesion.cola.push(limpio);
  const creada = creadaEn.get(token) ?? Date.now();
  sesion.expiraEn = Math.min(Date.now() + TTL_MS, creada + TTL_MAXIMO_MS);
}

export function tomarSiguienteCodigo(token: string): string | null {
  const sesion = obtenerSesionViva(token);
  if (!sesion) throw new HttpError(404, "La sesión de escaneo no existe o expiró");

  const creada = creadaEn.get(token) ?? Date.now();
  sesion.expiraEn = Math.min(Date.now() + TTL_MS, creada + TTL_MAXIMO_MS);
  return sesion.cola.shift() ?? null;
}

export function guardarFoto(token: string, buffer: Buffer, mimetype: string) {
  const sesion = obtenerSesionViva(token);
  if (!sesion) throw new HttpError(404, "La sesión no existe o expiró");
  sesion.foto = { buffer, mimetype };
  const creada = creadaEn.get(token) ?? Date.now();
  sesion.expiraEn = Math.min(Date.now() + TTL_MS, creada + TTL_MAXIMO_MS);
}

export function tomarFoto(token: string) {
  const sesion = obtenerSesionViva(token);
  if (!sesion) throw new HttpError(404, "La sesión no existe o expiró");
  const foto = sesion.foto;
  sesion.foto = null;
  const creada = creadaEn.get(token) ?? Date.now();
  sesion.expiraEn = Math.min(Date.now() + TTL_MS, creada + TTL_MAXIMO_MS);
  return foto;
}

export function eliminarSesion(token: string) {
  sesiones.delete(token);
  creadaEn.delete(token);
}
