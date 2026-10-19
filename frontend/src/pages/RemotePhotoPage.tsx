import { useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, CheckCircle2, Loader2, WifiOff } from "lucide-react";
import { apiClient } from "@/lib/api-client";

/**
 * Achica la foto antes de mandarla (las del celular pesan varios MB): lado
 * mayor de 1600px en JPEG, que sobra para la foto de un producto.
 */
async function comprimirImagen(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * Página que abre el celular al escanear el QR de "Foto desde el celular"
 * (FotoDesdeCelularModal). Pública, sin login: el token de la URL alcanza
 * para mandar la foto a la PC que la pidió.
 */
export function RemotePhotoPage() {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<"listo" | "enviando" | "enviada" | "error" | "invalido">("listo");
  const [preview, setPreview] = useState<string | null>(null);

  async function enviar(file: File) {
    if (!token) return;
    setPreview(URL.createObjectURL(file));
    setEstado("enviando");
    try {
      const blob = await comprimirImagen(file);
      const formData = new FormData();
      formData.append("foto", blob, "foto.jpg");
      await apiClient.post(`/sesiones-escaneo/${token}/foto`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEstado("enviada");
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setEstado(status === 404 ? "invalido" : "error");
    }
  }

  if (estado === "invalido") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface p-6 text-center">
        <WifiOff size={40} className="text-on-surface-variant" />
        <h1 className="text-lg font-semibold text-on-surface">El enlace venció</h1>
        <p className="text-sm text-on-surface-variant">Volvé a tocar "Desde el celular" en la PC y escaneá el QR nuevo.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-surface p-6 text-center">
      <div className="mb-6 flex items-center gap-2">
        <Camera size={22} className="text-primary" />
        <h1 className="text-lg font-semibold text-on-surface">Foto del producto</h1>
      </div>

      <div className="mb-6 flex aspect-square w-full max-w-xs items-center justify-center overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
        {preview ? (
          <img src={preview} alt="Foto" className="h-full w-full object-cover" />
        ) : (
          <Camera size={48} className="text-on-surface-variant" />
        )}
      </div>

      {estado === "enviando" && (
        <p className="mb-4 flex items-center gap-2 text-sm text-on-surface-variant">
          <Loader2 size={16} className="animate-spin" />
          Enviando a la PC...
        </p>
      )}
      {estado === "enviada" && (
        <p className="mb-4 flex items-center gap-2 rounded-md bg-secondary-container px-3 py-2 text-sm font-medium text-on-secondary-container">
          <CheckCircle2 size={16} />
          Listo, la foto ya está en la PC.
        </p>
      )}
      {estado === "error" && <p className="mb-4 text-sm text-error">No se pudo enviar. Probá de nuevo.</p>}

      <label className="inline-flex w-full max-w-xs cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-base font-medium text-on-primary">
        <Camera size={20} />
        {estado === "enviada" ? "Sacar otra foto" : "Sacar foto"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={estado === "enviando"}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void enviar(file);
          }}
        />
      </label>
      <p className="mt-3 text-xs text-on-surface-variant">También podés elegir una foto de la galería.</p>
    </div>
  );
}
