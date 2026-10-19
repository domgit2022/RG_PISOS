import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Loader2, Smartphone, TriangleAlert, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";

/**
 * Pide la foto de un producto al celular: crea una sesión corta, muestra un
 * QR con el link a /foto/:token y espera (polling) a que el celular suba la
 * foto. Cuando llega, la entrega como File, igual que si se hubiera elegido
 * un archivo de la PC.
 */
export function FotoDesdeCelularModal({ onFoto, onClose }: { onFoto: (file: File) => void; onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accedidoPorLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  // En refs para que el polling no se reinicie en cada render del padre.
  const onFotoRef = useRef(onFoto);
  const onCloseRef = useRef(onClose);
  onFotoRef.current = onFoto;
  onCloseRef.current = onClose;

  useEffect(() => {
    let cancelado = false;
    let tokenCreado: string | null = null;
    apiClient
      .post<{ token: string }>("/sesiones-escaneo")
      .then(async ({ data }) => {
        tokenCreado = data.token;
        if (cancelado) return;
        setToken(data.token);
        setQr(await QRCode.toDataURL(`${window.location.origin}/foto/${data.token}`, { margin: 1, width: 220 }));
      })
      .catch(() => setError("No se pudo generar el código QR."));
    return () => {
      cancelado = true;
      if (tokenCreado) void apiClient.delete(`/sesiones-escaneo/${tokenCreado}`).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let activo = true;
    const intervalo = window.setInterval(async () => {
      try {
        const res = await apiClient.get<Blob>(`/sesiones-escaneo/${token}/foto`, { responseType: "blob" });
        if (!activo || res.status !== 200 || !res.data.size) return;
        activo = false;
        const tipo = res.data.type || "image/jpeg";
        onFotoRef.current(new File([res.data], `foto-celular.${tipo.split("/")[1] ?? "jpg"}`, { type: tipo }));
        onCloseRef.current();
      } catch (err) {
        if ((err as { response?: { status?: number } })?.response?.status === 404) {
          setError("El código venció. Cerrá y volvé a abrir para generar uno nuevo.");
          activo = false;
        }
      }
    }, 1500);
    return () => {
      activo = false;
      window.clearInterval(intervalo);
    };
  }, [token]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-surface-container-lowest p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Smartphone size={16} />
            Foto desde el celular
          </h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-surface-container">
            <X size={18} />
          </button>
        </div>
        {accedidoPorLocalhost && (
          <p className="mb-3 flex items-start gap-2 rounded-md bg-error-container px-3 py-2 text-left text-xs text-on-error-container">
            <TriangleAlert size={16} className="shrink-0" />
            Entraste por "localhost": el celular no va a poder abrir este link. Entrá a la app por la IP de la red.
          </p>
        )}
        {error ? (
          <p className="text-sm text-error">{error}</p>
        ) : qr ? (
          <>
            <img src={qr} alt="QR para sacar la foto con el celular" className="mx-auto rounded-md bg-white p-2" />
            <p className="mt-3 text-sm text-on-surface-variant">
              Escaneá el QR con la cámara del celular, sacá la foto y va a aparecer acá sola.
            </p>
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
              <Loader2 size={12} className="animate-spin" />
              Esperando la foto...
            </p>
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">Generando código...</p>
        )}
      </div>
    </div>
  );
}
