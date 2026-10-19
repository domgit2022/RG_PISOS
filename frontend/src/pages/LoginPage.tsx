import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { useBranding } from "@/hooks/useBranding";
import logoFallback from "@/assets/logo-rgpisos.svg";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSesion = useAuthStore((s) => s.setSesion);
  const { logoUrl, nombreComercial } = useBranding();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const { data: setupEstado } = useQuery({
    queryKey: ["setup-estado"],
    queryFn: async () => (await apiClient.get<{ requiereSetup: boolean }>("/setup/estado")).data,
  });

  useEffect(() => {
    if (setupEstado?.requiereSetup) navigate("/setup", { replace: true });
  }, [setupEstado, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const { data } = await apiClient.post("/auth/login", { username, password });
      setSesion(data.token, data.usuario);
      navigate("/");
    } catch {
      setError(t("login.error"));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-8 shadow-sm"
      >
        <img src={logoUrl ?? logoFallback} alt={nombreComercial} className="mx-auto mb-5 h-36 w-36 object-contain" />
        <p className="mb-6 text-center text-sm text-on-surface-variant">{t("login.title")}</p>

        <label className="mb-1 block text-sm font-medium">{t("login.username")}</label>
        <input
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium">{t("login.password")}</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />

        {error && <p className="mb-4 text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-md bg-primary py-2 text-sm font-medium text-on-primary disabled:opacity-60"
        >
          {t("login.submit")}
        </button>
      </form>
    </div>
  );
}
