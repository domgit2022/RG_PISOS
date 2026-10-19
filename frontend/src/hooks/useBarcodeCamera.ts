import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";

/**
 * Lee códigos de barra con la cámara del dispositivo (preferentemente la
 * trasera en celulares) usando ZXing, y los reporta vía `onDetected`.
 * Requiere contexto seguro (HTTPS o localhost); si la cámara falla o no
 * está disponible, deja `error` con un mensaje para mostrar.
 *
 * Por defecto es "de un solo tiro": corta la cámara apenas lee el primer
 * código. Con `continuo: true` sigue leyendo (para la página que abre el
 * celular al vincularse, `/escanear/:token`, donde se escanean varios
 * productos seguidos) y reporta cada código que decodifica, sin filtrar
 * repetidos acá: si el código sigue encuadrado, ZXing vuelve a decodificarlo
 * cada ~500ms y este hook lo vuelve a reportar cada vez. Evitar reenvíos de
 * un código ya procesado con éxito es responsabilidad de quien consume
 * `onDetected` (así, si un envío falla, el siguiente frame reintenta solo
 * en vez de quedar "trabado" pensando que ya se mandó).
 */
export function useBarcodeCamera(
  activo: boolean,
  onDetected: (codigo: string) => void,
  opciones?: { continuo?: boolean }
) {
  const { t } = useTranslation();
  const continuo = opciones?.continuo ?? false;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Igual que en usePhoneScanPairing: `onDetected` suele ser una arrow
  // function inline del padre (nueva en cada render). Leerla desde un ref
  // evita reiniciar la cámara por cada re-render ajeno del padre.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!activo) return;
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("scanner.unsupported"));
      return;
    }

    const reader = new BrowserMultiFormatReader();
    let vivo = true;

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current!,
        (result, err, controls) => {
          if (!vivo) return;
          controlsRef.current = controls;
          if (result) {
            const codigo = result.getText();
            if (!continuo) {
              controls.stop();
            }
            onDetectedRef.current(codigo);
          } else if (err && !(err instanceof NotFoundException)) {
            setError(t("scanner.error"));
          }
        }
      )
      .then((controls) => {
        controlsRef.current = controls;
      })
      .catch(() => {
        if (vivo) setError(t("scanner.permissionDenied"));
      });

    return () => {
      vivo = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [activo, continuo, t]);

  return { videoRef, error };
}
