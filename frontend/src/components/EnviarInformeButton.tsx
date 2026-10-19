import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Envía en el momento el informe de vencimientos y stock bajo a los
 * destinatarios configurados (no cambia la fecha del envío automático).
 */
export function EnviarInformeButton() {
  const puede = useAuthStore((s) => s.tienePermiso("reportes.ver") || s.tienePermiso("configuracion.gestionar"));
  const enviar = useMutation({
    mutationFn: async () =>
      (await apiClient.post<{ enviadoA: string[]; conContenido: boolean }>("/alertas/enviar-informe")).data,
  });
  if (!puede) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => enviar.mutate()}
        disabled={enviar.isPending}
        className="flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary disabled:opacity-60"
      >
        <Mail size={16} />
        {enviar.isPending ? "Enviando..." : "Enviar informe por mail"}
      </button>
      {enviar.isSuccess && (
        <p className="max-w-xs text-right text-xs text-secondary">
          Enviado a {enviar.data.enviadoA.join(", ")}
          {enviar.data.conContenido ? "" : " (hoy no hay vencimientos ni stock bajo)"}
        </p>
      )}
      {enviar.isError && (
        <p className="max-w-xs text-right text-xs text-error">
          {(enviar.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "No se pudo enviar el informe."}
        </p>
      )}
    </div>
  );
}
