import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { X, Keyboard, Smartphone, Monitor, RefreshCw, TriangleAlert, QrCode, Loader2 } from "lucide-react";
import { useBarcodeCamera } from "@/hooks/useBarcodeCamera";
import { usePhoneScanPairing } from "@/hooks/usePhoneScanPairing";

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (codigo: string) => void;
}

type Modo = "camara" | "celular";

const STORAGE_KEY_MODO = "rgpisos-scanner-modo";

function leerModoRecordado(): Modo {
  try {
    return sessionStorage.getItem(STORAGE_KEY_MODO) === "celular" ? "celular" : "camara";
  } catch {
    return "camara";
  }
}

/**
 * Modal para leer un código de barras, con dos formas de hacerlo:
 * - "camara": la cámara de este dispositivo (la trasera si es celular).
 * - "celular": vincula el celular como lector remoto por QR, para cuando se
 *   está trabajando en una PC sin cámara útil. Ver `/escanear/:token`
 *   (RemoteScanPage) del lado del celular.
 * Si la cámara falla o no está disponible, siempre queda el campo para
 * ingresar el código a mano.
 */
export function BarcodeScannerModal({ open, onClose, onDetected }: BarcodeScannerModalProps) {
  const { t } = useTranslation();
  // Recuerda la última pestaña elegida ("cámara" o "celular") para no
  // volver a la cámara de la PC (y prenderle la luz) cada vez que se abre
  // el escáner, una vez que ya se vinculó un celular.
  const [modo, setModoState] = useState<Modo>(leerModoRecordado);
  const [manual, setManual] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  // El QR apunta a `window.location.origin`: si la PC entró por "localhost",
  // ese link es inútil para el celular (para él, "localhost" es él mismo).
  // Hay que entrar a la app por la IP de la red local para que el QR sirva.
  const accedidoPorLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  function setModo(m: Modo) {
    setModoState(m);
    try {
      sessionStorage.setItem(STORAGE_KEY_MODO, m);
    } catch {
      // no-op
    }
  }

  useEffect(() => {
    if (!open) return;
    setManual("");
  }, [open]);

  const { videoRef, error: errorCamara } = useBarcodeCamera(open && modo === "camara", onDetected);

  const activoParaCelular = open && modo === "celular";
  const {
    token,
    creando: creandoVinculo,
    error: errorVinculo,
    olvidarCelular,
  } = usePhoneScanPairing(activoParaCelular, onDetected);

  // Si ya había un token vinculado (de un uso anterior, dentro de la misma
  // pestaña) justo cuando se entra a esta pestaña, el celular ya está
  // conectado y escuchando: no hace falta mostrarle el QR de nuevo, alcanza
  // con esperar el próximo código. Solo se muestra el QR cuando la
  // vinculación es realmente nueva (o el usuario pide vincular otro
  // celular con el botón de abajo).
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  const [mostrarQR, setMostrarQR] = useState(() => token === null);
  useEffect(() => {
    if (activoParaCelular) setMostrarQR(tokenRef.current === null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activoParaCelular]);

  useEffect(() => {
    if (!token) {
      setQrDataUrl(null);
      return;
    }
    const url = `${window.location.origin}/escanear/${token}`;
    QRCode.toDataURL(url, { margin: 1, width: 220 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [token]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-lg bg-surface-container-lowest p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("scanner.title")}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-surface-container">
            <X size={18} />
          </button>
        </div>

        <div className="mb-3 flex gap-1 rounded-md bg-surface-container p-1 text-sm">
          <button
            type="button"
            onClick={() => setModo("camara")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 font-medium ${
              modo === "camara" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"
            }`}
          >
            <Monitor size={14} />
            {t("scanner.tabCamera")}
          </button>
          <button
            type="button"
            onClick={() => setModo("celular")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 font-medium ${
              modo === "celular" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"
            }`}
          >
            <Smartphone size={14} />
            {t("scanner.tabPhone")}
          </button>
        </div>

        {modo === "camara" ? (
          !errorCamara ? (
            <div className="relative overflow-hidden rounded-md bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-md border-2 border-primary" />
            </div>
          ) : (
            <p className="rounded-md bg-error-container px-3 py-2 text-sm text-on-error-container">{errorCamara}</p>
          )
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-md border border-outline-variant/40 bg-surface-container p-4 text-center">
            {accedidoPorLocalhost && (
              <p className="flex items-start gap-2 rounded-md bg-error-container px-3 py-2 text-left text-xs text-on-error-container">
                <TriangleAlert size={28} className="shrink-0" />
                {t("scanner.pairingLocalhostWarning")}
              </p>
            )}
            {errorVinculo && <p className="text-sm text-error">{errorVinculo}</p>}
            {!mostrarQR ? (
              <>
                <Loader2 size={28} className="animate-spin text-primary" />
                <p className="text-sm text-on-surface-variant">{t("scanner.pairingListening")}</p>
                <button
                  type="button"
                  onClick={() => setMostrarQR(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <QrCode size={12} />
                  {t("scanner.pairingShowQR")}
                </button>
              </>
            ) : (
              <>
                {creandoVinculo && !qrDataUrl && (
                  <p className="text-sm text-on-surface-variant">{t("scanner.pairingLoading")}</p>
                )}
                {qrDataUrl && (
                  <>
                    <img src={qrDataUrl} alt="QR para vincular el celular" className="rounded-md bg-white p-2" />
                    <p className="text-sm text-on-surface-variant">{t("scanner.pairingHint")}</p>
                    <button
                      type="button"
                      onClick={olvidarCelular}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <RefreshCw size={12} />
                      {t("scanner.pairingForget")}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <p className="mt-3 text-xs text-on-surface-variant">
          {modo === "camara" ? t("scanner.hintCamera") : t("scanner.hintPhone")}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) onDetected(manual.trim());
          }}
          className="mt-3 flex items-center gap-2"
        >
          <Keyboard size={16} className="shrink-0 text-on-surface-variant" />
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder={t("scanner.manualPlaceholder")}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-on-primary"
          >
            {t("scanner.use")}
          </button>
        </form>
      </div>
    </div>
  );
}
