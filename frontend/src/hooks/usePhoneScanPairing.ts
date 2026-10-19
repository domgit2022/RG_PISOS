import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";

const STORAGE_KEY = "rgpisos-scan-pairing-token";
const POLL_MS = 1200;

/**
 * Vincula el celular como lector remoto: crea (o reutiliza) una sesión de
 * escaneo, la guarda en sessionStorage para no tener que volver a escanear
 * el QR en cada uso dentro de la misma pestaña, y el celular manda los
 * códigos a `/escanear/:token` (sin login).
 *
 * Una vez vinculado, escucha SIEMPRE que haya un token guardado — no hace
 * falta abrir el modal de escanear para que un código escaneado llegue al
 * campo correspondiente. `permitirCrear` solo controla si, cuando todavía
 * no hay ningún celular vinculado, se puede iniciar una vinculación nueva
 * (eso sí requiere que el usuario haya abierto la pestaña "Mi celular",
 * porque hay que mostrarle el QR).
 */
export function usePhoneScanPairing(permitirCrear: boolean, onDetected: (codigo: string) => void) {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const creandoRef = useRef(false);

  // `onDetected` suele ser una función nueva en cada render del padre (una
  // arrow function inline). Si la usáramos directo como dependencia del
  // efecto de abajo, cada re-render del padre reiniciaría el efecto — y,
  // peor, podría volver a disparar `crearNuevo()` mientras la primera
  // creación todavía está en vuelo, generando DOS sesiones (una es la que
  // termina en el QR, otra la que el celular nunca ve). Guardarla en un ref
  // evita eso: el efecto solo depende de `token`.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const crearNuevo = useCallback(async () => {
    if (creandoRef.current) return;
    creandoRef.current = true;
    setError(null);
    setCreando(true);
    try {
      const { data } = await apiClient.post<{ token: string }>("/sesiones-escaneo");
      try {
        sessionStorage.setItem(STORAGE_KEY, data.token);
      } catch {
        // Si sessionStorage no está disponible, igual funciona: solo no se
        // recuerda el token para la próxima vez.
      }
      setToken(data.token);
    } catch {
      setError("No se pudo iniciar la vinculación con el celular. Probá de nuevo.");
    } finally {
      setCreando(false);
      creandoRef.current = false;
    }
  }, []);

  // Escucha en segundo plano: corre siempre que haya un token, sin importar
  // si el modal de escanear está abierto.
  useEffect(() => {
    if (!token) return;

    let cancelado = false;

    async function consultar() {
      try {
        const { data } = await apiClient.get<{ codigo: string | null }>(`/sesiones-escaneo/${token}`);
        if (!cancelado && data.codigo) onDetectedRef.current(data.codigo);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          try {
            sessionStorage.removeItem(STORAGE_KEY);
          } catch {
            // no-op
          }
          if (!cancelado) setToken(null);
        }
      }
    }

    intervalRef.current = window.setInterval(consultar, POLL_MS);

    return () => {
      cancelado = true;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [token]);

  // Crear una vinculación nueva: solo cuando el usuario lo pide (abrió la
  // pestaña "Mi celular") y todavía no hay ninguna.
  useEffect(() => {
    if (permitirCrear && !token) void crearNuevo();
  }, [permitirCrear, token, crearNuevo]);

  const olvidarCelular = useCallback(() => {
    if (token) apiClient.delete(`/sesiones-escaneo/${token}`).catch(() => {});
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // no-op
    }
    setToken(null);
  }, [token]);

  return { token, creando, error, olvidarCelular };
}
