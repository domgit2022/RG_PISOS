import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { API_ORIGIN } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";

const INTERVALO_MS = 3000;
const TIMEOUT_MS = 5000;
/** Si la app estuvo en segundo plano más que esto, se vuelve a chequear el servidor. */
const AUSENCIA_MS = 5 * 60 * 1000;

async function servidorResponde() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_ORIGIN}/health`, { signal: controller.signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * El backend (Render, plan gratuito) se duerme sin uso y tarda hasta un
 * minuto en despertar: las consultas hechas mientras tanto fallan y la app
 * quedaba en cero hasta recargar. Esto chequea el servidor al entrar y al
 * volver a la app (típico en el celular); mientras no responde muestra un
 * aviso, y cuando responde vuelve a pedir todos los datos solo.
 */
export function ConexionServidor() {
  const [esperando, setEsperando] = useState(false);
  const chequeando = useRef(false);
  const ocultaDesde = useRef<number | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function chequear() {
      if (chequeando.current) return;
      chequeando.current = true;
      let huboFalla = false;
      // Si en 1,5 s no respondió, avisamos (si responde antes, ni se ve).
      const aviso = window.setTimeout(() => !cancelado && setEsperando(true), 1500);
      while (!cancelado && !(await servidorResponde())) {
        huboFalla = true;
        setEsperando(true);
        await new Promise((r) => window.setTimeout(r, INTERVALO_MS));
      }
      window.clearTimeout(aviso);
      chequeando.current = false;
      if (cancelado) return;
      setEsperando(false);
      if (huboFalla) void queryClient.invalidateQueries();
      else void queryClient.refetchQueries({ type: "active", predicate: (q) => q.state.status === "error" });
    }

    function alCambiarVisibilidad() {
      if (document.visibilityState === "hidden") {
        ocultaDesde.current = Date.now();
      } else if (ocultaDesde.current && Date.now() - ocultaDesde.current > AUSENCIA_MS) {
        ocultaDesde.current = null;
        void chequear();
      }
    }

    void chequear();
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, []);

  if (!esperando) return null;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <Loader2 size={16} className="shrink-0 animate-spin" />
      Conectando con el servidor… puede tardar hasta un minuto si estuvo inactivo. Los datos aparecen solos.
    </div>
  );
}
