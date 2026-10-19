import { useCallback, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Keyboard, ScanBarcode, WifiOff } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useBarcodeCamera } from "@/hooks/useBarcodeCamera";

/**
 * Página que abre el celular al escanear el QR mostrado en la PC
 * (BarcodeScannerModal, pestaña "Mi celular"). Pública, sin login: el token
 * de la URL es lo único que hace falta para mandar códigos a esa sesión.
 * Queda escaneando de forma continua para poder cargar varios productos
 * seguidos sin volver a abrir nada.
 */
export function RemoteScanPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [manual, setManual] = useState("");
  const [enviados, setEnviados] = useState(0);
  const [ultimoEnviado, setUltimoEnviado] = useState<string | null>(null);
  const [invalido, setInvalido] = useState(false);
  // La cámara reporta CADA frame decodificado (más o menos cada 500ms
  // mientras el código siga encuadrado), sin filtrar repetidos: acá
  // decidimos no reenviar un código que ya se mandó con éxito. La clave es
  // que solo se marca como "ya enviado" si el POST realmente tuvo éxito —
  // si falla (corte de red, el backend recién despertando en Render, etc.)
  // no se marca, así el siguiente frame reintenta solo en vez de quedar
  // trabado pensando que ya se había mandado.
  const ultimoExitosoRef = useRef<string | null>(null);
  const enviandoRef = useRef<string | null>(null);

  const enviarCodigo = useCallback(
    async (codigo: string) => {
      if (!token) return;
      if (codigo === ultimoExitosoRef.current) return;
      if (enviandoRef.current === codigo) return; // ya hay un envío de este mismo código en curso
      enviandoRef.current = codigo;
      try {
        await apiClient.post(`/sesiones-escaneo/${token}/codigo`, { codigo });
        ultimoExitosoRef.current = codigo;
        setEnviados((n) => n + 1);
        setUltimoEnviado(codigo);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) setInvalido(true);
        // otros errores: no marcamos éxito, se reintenta con el próximo frame
      } finally {
        if (enviandoRef.current === codigo) enviandoRef.current = null;
      }
    },
    [token]
  );

  const { videoRef, error: errorCamara } = useBarcodeCamera(!invalido, enviarCodigo, { continuo: true });

  if (invalido) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface p-6 text-center">
        <WifiOff size={40} className="text-on-surface-variant" />
        <h1 className="text-lg font-semibold text-on-surface">{t("remoteScan.invalidTitle")}</h1>
        <p className="text-sm text-on-surface-variant">{t("remoteScan.invalidHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface p-4">
      <div className="mb-4 flex items-center gap-2">
        <ScanBarcode size={22} className="text-primary" />
        <h1 className="text-lg font-semibold text-on-surface">{t("remoteScan.title")}</h1>
      </div>

      {!errorCamara ? (
        <div className="relative mb-4 overflow-hidden rounded-lg bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-10 top-1/2 h-20 -translate-y-1/2 rounded-md border-2 border-primary" />
        </div>
      ) : (
        <p className="mb-4 rounded-md bg-error-container px-3 py-2 text-sm text-on-error-container">{errorCamara}</p>
      )}

      <p className="mb-3 text-center text-sm text-on-surface-variant">{t("remoteScan.subtitle")}</p>

      {enviados > 0 && (
        <div className="mb-3 flex items-center justify-center gap-2 rounded-md bg-secondary-container px-3 py-2 text-sm font-medium text-on-secondary-container">
          <CheckCircle2 size={16} />
          {t("remoteScan.sent")}: {ultimoEnviado}
        </div>
      )}
      {enviados > 1 && <p className="mb-3 text-center text-xs text-on-surface-variant">{t("remoteScan.sentHint")}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) {
            void enviarCodigo(manual.trim());
            setManual("");
          }
        }}
        className="mt-auto flex items-center gap-2"
      >
        <Keyboard size={16} className="shrink-0 text-on-surface-variant" />
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder={t("remoteScan.manualPlaceholder")}
          className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <button type="submit" className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-on-primary">
          {t("scanner.use")}
        </button>
      </form>
    </div>
  );
}
