import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Mail, TriangleAlert } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Diagnostico {
  metodo: "relay" | "smtp" | "ninguno";
  destinatarios: string[];
  lotesAVencer: number;
  productosStockBajo: number;
  frecuencia: string | null;
  ultimoEnvio: string | null;
  correspondeHoy: boolean;
  errores?: Record<"configuracion" | "vencimientos" | "stockBajo" | "destinatarios", string | null>;
}

const METODO: Record<Diagnostico["metodo"], { texto: string; ok: boolean }> = {
  relay: { texto: "Google Apps Script (Gmail)", ok: true },
  smtp: { texto: "SMTP (Render gratuito lo bloquea: puede fallar)", ok: false },
  ninguno: { texto: "Sin configurar: no se envía nada", ok: false },
};

/**
 * Estado del envío del informe de vencimientos y stock bajo, con un botón
 * para mandarlo ahora y ver el error real si falla.
 */
export function DiagnosticoMail() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["diagnostico-mail"],
    retry: false,
    queryFn: async () => (await apiClient.get<Diagnostico>("/configuracion/diagnostico-mail")).data,
  });
  const probar = useMutation({
    mutationFn: async () =>
      (await apiClient.post<{ enviadoA: string[]; conContenido: boolean }>("/configuracion/enviar-informe-prueba")).data,
    onSettled: () => void refetch(),
  });
  const errorPrueba = (probar.error as { response?: { data?: { error?: string } } } | null)?.response?.data?.error;

  const fila = (ok: boolean, titulo: string, detalle: string) => (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-secondary" />
      ) : (
        <TriangleAlert size={16} className="mt-0.5 shrink-0 text-stock-low" />
      )}
      <span>
        <span className="font-medium">{titulo}:</span> <span className="text-on-surface-variant">{detalle}</span>
      </span>
    </li>
  );

  return (
    <section className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-medium">
        <Mail size={18} />
        Envío de mails
      </h2>
      <p className="mb-4 text-xs text-on-surface-variant">
        El informe sale con el primer uso de la app del día (y con el cron externo), si hay vencimientos próximos o
        stock bajo y ya corresponde según la frecuencia.
      </p>

      {isError ? (
        <p className="mb-4 text-sm text-error">
          No se pudo revisar:{" "}
          {(error as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ??
            (error as { message?: string })?.message}
        </p>
      ) : isLoading || !data ? (
        <p className="text-sm text-on-surface-variant">Revisando...</p>
      ) : (
        <ul className="mb-4 space-y-2 text-sm">
          {fila(METODO[data.metodo].ok, "Método de envío", METODO[data.metodo].texto)}
          {fila(
            data.destinatarios.length > 0,
            "Destinatarios",
            data.destinatarios.length > 0
              ? data.destinatarios.join(", ")
              : "ninguno (activá \"Recibe avisos\" y cargá el email en Usuarios)"
          )}
          {fila(
            data.lotesAVencer + data.productosStockBajo > 0,
            "Contenido de hoy",
            `${data.lotesAVencer} lotes por vencer, ${data.productosStockBajo} productos con stock bajo${
              data.lotesAVencer + data.productosStockBajo === 0 ? " (sin contenido no se manda el informe)" : ""
            }`
          )}
          {data.errores &&
            Object.entries(data.errores)
              .filter(([, e]) => e)
              .map(([paso, e]) => (
                <li key={paso} className="flex items-start gap-2 text-error">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium">Error al leer {paso}:</span> {e}
                  </span>
                </li>
              ))}
          {fila(
            data.correspondeHoy,
            "Frecuencia",
            data.correspondeHoy
              ? "corresponde enviar hoy"
              : `ya se envió ${data.ultimoEnvio ? new Date(data.ultimoEnvio).toLocaleString() : ""}; el próximo sale según la frecuencia`
          )}
        </ul>
      )}

      <button
        type="button"
        onClick={() => probar.mutate()}
        disabled={probar.isPending}
        className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary disabled:opacity-60"
      >
        {probar.isPending ? "Enviando..." : "Enviar informe ahora"}
      </button>
      {probar.isSuccess && (
        <p className="mt-2 text-sm text-secondary">
          Enviado a {probar.data.enviadoA.join(", ")}
          {probar.data.conContenido ? "" : " (mail de prueba: hoy no hay contenido)"}. Revisá también la carpeta de spam.
        </p>
      )}
      {probar.isError && <p className="mt-2 text-sm text-error">{errorPrueba ?? "No se pudo enviar el mail."}</p>}
      <p className="mt-2 text-xs text-on-surface-variant">El envío manual no cambia la fecha del último envío automático. También está en Reportes.</p>
    </section>
  );
}
