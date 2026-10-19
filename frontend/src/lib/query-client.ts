import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Errores 4xx no se reintentan (no van a cambiar). Los de red o 5xx sí:
      // el backend puede estar despertando (Render gratuito) y tardar ~1 minuto.
      retry: (intentos, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return intentos < 5;
      },
      retryDelay: (intento) => Math.min(1000 * 2 ** intento, 15_000),
    },
  },
});
