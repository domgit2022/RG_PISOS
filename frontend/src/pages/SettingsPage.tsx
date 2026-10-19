import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { DiagnosticoMail } from "@/components/DiagnosticoMail";
import { apiClient, resolveAssetUrl } from "@/lib/api-client";
import { ColorSwatchPicker } from "@/components/ColorSwatchPicker";
import type { Configuracion, Traduccion } from "@/lib/types";

const ETIQUETA_FRECUENCIA: Record<Configuracion["frecuenciaInformeVencimientos"], string> = {
  DIARIO: "settings.frequencyDaily",
  SEMANAL: "settings.frequencyWeekly",
  QUINCENAL: "settings.frequencyBiweekly",
  MENSUAL: "settings.frequencyMonthly",
};

// Mismos días mínimos que usa el backend (alerts.service) para decidir el envío.
const DIAS_MINIMOS_FRECUENCIA: Record<Configuracion["frecuenciaInformeVencimientos"], number> = {
  DIARIO: 1,
  SEMANAL: 7,
  QUINCENAL: 15,
  MENSUAL: 30,
};

/**
 * Fecha a partir de la cual corresponde el próximo informe, o null si ya
 * corresponde en la próxima revisión. Se calcula con la frecuencia del
 * formulario (aunque no esté guardada) para ver el efecto antes de guardar.
 */
function proximoEnvioInforme(ultimoEnvio: string | null, frecuencia: Configuracion["frecuenciaInformeVencimientos"]) {
  if (!ultimoEnvio) return null;
  const proximo = new Date(ultimoEnvio);
  proximo.setHours(0, 0, 0, 0);
  proximo.setDate(proximo.getDate() + DIAS_MINIMOS_FRECUENCIA[frecuencia]);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return proximo <= hoy ? null : proximo;
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["configuracion"],
    queryFn: async () => (await apiClient.get<Configuracion>("/configuracion")).data,
  });
  const { data: traducciones } = useQuery({
    queryKey: ["traducciones"],
    queryFn: async () => (await apiClient.get<Traduccion[]>("/traducciones")).data,
  });

  const [form, setForm] = useState<Partial<Configuracion>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const guardarConfig = useMutation({
    mutationFn: async (payload: Partial<Configuracion>) =>
      (await apiClient.put<Configuracion>("/configuracion", payload)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(["configuracion"], data);
      queryClient.invalidateQueries({ queryKey: ["branding-publica"] });
      setSavedAt(Date.now());
    },
  });

  const guardarTraduccion = useMutation({
    mutationFn: async (payload: Pick<Traduccion, "namespace" | "clave" | "idioma" | "valor">) =>
      (await apiClient.put<Traduccion>("/traducciones", payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["traducciones"] }),
  });

  const [logoError, setLogoError] = useState<string | null>(null);
  const subirLogo = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);
      return (
        await apiClient.post<Configuracion>("/configuracion/logo", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["configuracion"], data);
      queryClient.invalidateQueries({ queryKey: ["branding-publica"] });
      setForm((f) => ({ ...f, logoUrl: data.logoUrl }));
      setLogoError(null);
    },
    onError: (err: unknown) =>
      setLogoError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("settings.logoUploadError")),
  });

  function handleSave() {
    guardarConfig.mutate(form);
  }

  function handleIdiomaChange(idioma: "ES" | "EN") {
    setForm((f) => ({ ...f, idiomaPredeterminado: idioma }));
    i18n.changeLanguage(idioma.toLowerCase());
  }

  const unidadesTraducciones = traducciones?.filter((tr) => tr.namespace === "unidad_medida") ?? [];
  const mediosPagoTraducciones = traducciones?.filter((tr) => tr.namespace === "medio_pago") ?? [];

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold text-on-surface">{t("settings.title")}</h1>

      <section className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6">
        <h2 className="mb-4 text-lg font-medium">{t("settings.branding")}</h2>

        <label className="mb-1 block text-sm font-medium">{t("settings.logo")}</label>
        <div className="mb-1 flex flex-wrap items-center gap-4">
          {form.logoUrl && (
            <img src={resolveAssetUrl(form.logoUrl) ?? undefined} alt={t("settings.logo")} className="h-20 w-20 rounded-md object-contain" />
          )}
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant">
            <Upload size={16} />
            {t("settings.uploadLogo")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) subirLogo.mutate(file);
              }}
            />
          </label>
        </div>
        <p className="mb-6 text-xs text-on-surface-variant">{t("settings.logoHint")}</p>
        {logoError && <p className="mb-4 text-sm text-error">{logoError}</p>}

        <label className="mb-1 block text-sm font-medium">{t("settings.businessName")}</label>
        <input
          value={form.nombreComercial ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, nombreComercial: e.target.value }))}
          className="mb-4 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium">{t("settings.legalName")}</label>
        <input
          value={form.razonSocial ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, razonSocial: e.target.value }))}
          className="mb-6 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />

        <div className="mb-4">
          <p className="mb-1 text-sm font-medium">{t("settings.colorPalette")}</p>
          <p className="mb-3 text-xs text-on-surface-variant">{t("settings.colorPaletteHint")}</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <ColorSwatchPicker
              label={t("settings.primaryColor")}
              value={form.colorPrimario ?? "#C96F00"}
              onChange={(hex) => setForm((f) => ({ ...f, colorPrimario: hex }))}
            />
            <ColorSwatchPicker
              label={t("settings.secondaryColor")}
              value={form.colorSecundario ?? "#5F5F5E"}
              onChange={(hex) => setForm((f) => ({ ...f, colorSecundario: hex }))}
            />
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6">
        <h2 className="mb-1 text-lg font-medium">{t("settings.language")}</h2>
        <p className="mb-4 text-xs text-on-surface-variant">{t("settings.languageHint")}</p>
        <div className="flex gap-2">
          {(["ES", "EN"] as const).map((idioma) => (
            <button
              key={idioma}
              onClick={() => handleIdiomaChange(idioma)}
              className={`rounded-md border px-4 py-2 text-sm font-medium ${
                form.idiomaPredeterminado === idioma
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant text-on-surface-variant"
              }`}
            >
              {idioma === "ES" ? t("settings.spanish") : t("settings.english")}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6">
        <h2 className="mb-1 text-lg font-medium">{t("settings.reportFrequency")}</h2>
        <p className="mb-4 text-xs text-on-surface-variant">{t("settings.reportFrequencyHint")}</p>
        <div className="flex flex-wrap gap-2">
          {(["DIARIO", "SEMANAL", "QUINCENAL", "MENSUAL"] as const).map((frecuencia) => (
            <button
              key={frecuencia}
              onClick={() => setForm((f) => ({ ...f, frecuenciaInformeVencimientos: frecuencia }))}
              className={`rounded-md border px-4 py-2 text-sm font-medium ${
                form.frecuenciaInformeVencimientos === frecuencia
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant text-on-surface-variant"
              }`}
            >
              {t(ETIQUETA_FRECUENCIA[frecuencia])}
            </button>
          ))}
        </div>
        {config && form.frecuenciaInformeVencimientos && (
          <dl className="mt-4 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="text-on-surface-variant">{t("settings.lastReportSent")}</dt>
            <dd className="font-data">
              {config.ultimoEnvioInformeVencimientos
                ? new Date(config.ultimoEnvioInformeVencimientos).toLocaleString()
                : t("settings.reportNeverSent")}
            </dd>
            <dt className="text-on-surface-variant">{t("settings.nextReport")}</dt>
            <dd className="font-data">
              {(() => {
                const proximo = proximoEnvioInforme(config.ultimoEnvioInformeVencimientos, form.frecuenciaInformeVencimientos);
                return proximo ? t("settings.nextReportFrom", { fecha: proximo.toLocaleDateString() }) : t("settings.nextReportNextCheck");
              })()}
            </dd>
          </dl>
        )}
        <p className="mt-2 text-xs text-on-surface-variant">{t("settings.nextReportHint")}</p>
      </section>

      <DiagnosticoMail />

      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={guardarConfig.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
        >
          {t("settings.save")}
        </button>
        {savedAt && <span className="text-sm text-secondary">{t("settings.saved")}</span>}
      </div>

      <section className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6">
        <h2 className="mb-1 text-lg font-medium">{t("settings.translations")}</h2>
        <p className="mb-4 text-xs text-on-surface-variant">{t("settings.translationsHint")}</p>

        <TranslationGroup
          titulo="Unidades de medida"
          items={unidadesTraducciones}
          onSave={(clave, valor) =>
            guardarTraduccion.mutate({ namespace: "unidad_medida", clave, idioma: "EN", valor })
          }
        />
        <TranslationGroup
          titulo="Medios de pago"
          items={mediosPagoTraducciones}
          onSave={(clave, valor) => guardarTraduccion.mutate({ namespace: "medio_pago", clave, idioma: "EN", valor })}
        />
      </section>
    </div>
  );
}

function TranslationGroup({
  titulo,
  items,
  onSave,
}: {
  titulo: string;
  items: Traduccion[];
  onSave: (clave: string, valor: string) => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});

  useEffect(() => {
    setValores(Object.fromEntries(items.map((item) => [item.clave, item.valor])));
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="mb-2 text-sm font-semibold text-on-surface-variant">{titulo}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.clave} className="flex items-center gap-2">
            <span className="w-40 truncate text-sm">{item.clave}</span>
            <input
              value={valores[item.clave] ?? ""}
              onChange={(e) => setValores((v) => ({ ...v, [item.clave]: e.target.value }))}
              onBlur={() => onSave(item.clave, valores[item.clave] ?? "")}
              className="flex-1 rounded-md border border-outline-variant px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
