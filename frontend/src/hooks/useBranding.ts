import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, resolveAssetUrl } from "@/lib/api-client";

export interface Branding {
  nombreComercial: string;
  logoUrl: string | null;
  colorPrimario: string;
  colorSecundario: string;
  idiomaPredeterminado: "ES" | "EN";
}

/**
 * Trae la identidad visual configurada en Configuración (logo, nombre
 * comercial, colores) desde el endpoint público (no requiere sesión, para
 * poder pintar el login también) y aplica los colores en vivo sobre las
 * variables CSS del tema, para que TODO el sistema —no solo esta pantalla—
 * refleje el cambio apenas se guarda.
 */
export function useBranding() {
  const query = useQuery({
    queryKey: ["branding-publica"],
    queryFn: async () => (await apiClient.get<Branding>("/configuracion/publica")).data,
    staleTime: 60_000,
  });

  useEffect(() => {
    const root = document.documentElement;
    if (query.data?.colorPrimario) root.style.setProperty("--color-primary", query.data.colorPrimario);
    if (query.data?.colorSecundario) root.style.setProperty("--color-secondary", query.data.colorSecundario);
  }, [query.data?.colorPrimario, query.data?.colorSecundario]);

  return {
    ...query,
    logoUrl: resolveAssetUrl(query.data?.logoUrl),
    nombreComercial: query.data?.nombreComercial ?? "RG Pisos",
  };
}
