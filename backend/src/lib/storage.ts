import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env.js";
import { HttpError } from "@/lib/http-error.js";

/**
 * Guarda archivos públicos (logo del comercio, fotos de productos).
 *
 * - Con Supabase configurado (SUPABASE_SERVICE_ROLE_KEY): van a Supabase
 *   Storage, necesario en hostings con disco efímero (Render, etc).
 * - Sin Supabase (servidor propio en una PC del local): van a la carpeta
 *   UPLOADS_DIR del disco y el backend los sirve en /uploads/...
 */
export const usaSupabaseStorage = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

function getClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(
      500,
      "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el backend para poder subir archivos"
    );
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

let bucketVerificado = false;

async function asegurarBucket() {
  if (bucketVerificado) return;
  const client = getClient();
  const { data: buckets, error: errorListado } = await client.storage.listBuckets();
  if (errorListado) {
    throw new HttpError(500, `No se pudo acceder a Supabase Storage: ${errorListado.message}`);
  }
  const existe = buckets?.some((b) => b.name === env.SUPABASE_STORAGE_BUCKET);
  if (!existe) {
    const { error } = await client.storage.createBucket(env.SUPABASE_STORAGE_BUCKET, { public: true });
    if (error) throw new HttpError(500, `No se pudo crear el bucket de Storage: ${error.message}`);
  }
  bucketVerificado = true;
}

async function subirASupabase(buffer: Buffer, nombreArchivo: string, contentType: string) {
  await asegurarBucket();
  const client = getClient();

  const { error } = await client.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(nombreArchivo, buffer, { contentType, upsert: true });

  if (error) throw new HttpError(500, `No se pudo subir el archivo a Storage: ${error.message}`);

  const { data } = client.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(nombreArchivo);
  return data.publicUrl;
}

async function guardarEnDisco(buffer: Buffer, nombreArchivo: string) {
  // basename: el nombre nunca puede escaparse de la carpeta de uploads.
  const nombreSeguro = path.basename(nombreArchivo);
  await fs.mkdir(env.UPLOADS_DIR, { recursive: true });
  await fs.writeFile(path.join(env.UPLOADS_DIR, nombreSeguro), buffer);
  return `/uploads/${encodeURIComponent(nombreSeguro)}`;
}

export async function subirArchivoPublico(buffer: Buffer, nombreArchivo: string, contentType: string) {
  return usaSupabaseStorage
    ? subirASupabase(buffer, nombreArchivo, contentType)
    : guardarEnDisco(buffer, nombreArchivo);
}
