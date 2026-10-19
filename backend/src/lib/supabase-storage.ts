import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env.js";
import { HttpError } from "@/lib/http-error.js";

/**
 * Sube archivos (hoy: el logo del comercio) a Supabase Storage en vez del
 * disco local del servidor. Necesario para que el logo sobreviva un
 * redeploy en hostings con disco efímero (Render, Railway free tier, etc).
 * Usa la service_role key porque corre en el backend, nunca en el browser.
 */
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

export async function subirArchivoPublico(buffer: Buffer, nombreArchivo: string, contentType: string) {
  await asegurarBucket();
  const client = getClient();

  const { error } = await client.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(nombreArchivo, buffer, { contentType, upsert: true });

  if (error) throw new HttpError(500, `No se pudo subir el archivo a Storage: ${error.message}`);

  const { data } = client.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(nombreArchivo);
  return data.publicUrl;
}
