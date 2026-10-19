import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { useBranding } from "@/hooks/useBranding";
import logoFallback from "@/assets/logo-rgpisos.png";

export function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSesion = useAuthStore((s) => s.setSesion);
  const { logoUrl, nombreComercial } = useBranding();

  const { data: estado, isLoading: cargandoEstado } = useQuery({
    queryKey: ["setup-estado"],
    queryFn: async () => (await apiClient.get<{ requiereSetup: boolean }>("/setup/estado")).data,
  });

  useEffect(() => {
    if (estado && !estado.requiereSetup) navigate("/login", { replace: true });
  }, [estado, navigate]);

  const [form, setForm] = useState({ nombreComercial: "", nombreCompleto: "", username: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const inicializar = useMutation({
    mutationFn: async () => (await apiClient.post("/setup/inicializar", form)).data,
    onSuccess: (data) => {
      setSesion(data.token, data.usuario);
      navigate("/");
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("setup.error")),
  });

  if (cargandoEstado) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          inicializar.mutate();
        }}
        className="w-full max-w-md rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-8 shadow-sm"
      >
        <img src={logoUrl ?? logoFallback} alt={nombreComercial} className="mb-4 h-20 w-auto max-w-[240px] object-contain" />
        <h1 className="mb-1 text-xl font-semibold text-on-surface">{t("setup.title")}</h1>
        <p className="mb-6 text-sm text-on-surface-variant">{t("setup.subtitle")}</p>

        <label className="mb-1 block text-sm font-medium">{t("setup.businessName")}</label>
        <input
          required
          value={form.nombreComercial}
          onChange={(e) => setForm((f) => ({ ...f, nombreComercial: e.target.value }))}
          className="mb-4 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium">{t("users.fullName")}</label>
        <input
          required
          value={form.nombreCompleto}
          onChange={(e) => setForm((f) => ({ ...f, nombreCompleto: e.target.value }))}
          className="mb-4 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium">{t("users.username")}</label>
        <input
          required
          placeholder="admin"
          value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
          className="mb-4 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium">{t("users.password")}</label>
        <input
          required
          type="password"
          minLength={8}
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          className="mb-4 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />

        {error && <p className="mb-4 text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={inicializar.isPending}
          className="w-full rounded-md bg-primary py-2 text-sm font-medium text-on-primary disabled:opacity-60"
        >
          {t("setup.submit")}
        </button>
      </form>
    </div>
  );
}
