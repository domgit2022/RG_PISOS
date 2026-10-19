import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, Pencil, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import type { Proveedor } from "@/lib/types";

const emptyForm = {
  nombre: "",
  cuit: "",
  contactoNombre: "",
  telefono: "",
  email: "",
  direccion: "",
  condicionesPago: "",
  activo: true,
};

export function SuppliersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: proveedores, isLoading } = useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => (await apiClient.get<Proveedor[]>("/proveedores")).data,
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function extraerError(err: unknown, fallback: string) {
    return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
  }

  function toPayload() {
    return {
      nombre: form.nombre,
      cuit: form.cuit.trim() || null,
      contactoNombre: form.contactoNombre.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      direccion: form.direccion.trim() || null,
      condicionesPago: form.condicionesPago.trim() || null,
    };
  }

  const crear = useMutation({
    mutationFn: async () => (await apiClient.post<Proveedor>("/proveedores", toPayload())).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proveedores"] });
      setForm(emptyForm);
      setError(null);
    },
    onError: (err: unknown) => setError(extraerError(err, t("suppliers.createError"))),
  });

  const guardar = useMutation({
    mutationFn: async () =>
      (await apiClient.put<Proveedor>(`/proveedores/${editingId}`, { ...toPayload(), activo: form.activo })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proveedores"] });
      handleCancelar();
    },
    onError: (err: unknown) => setError(extraerError(err, t("suppliers.updateError"))),
  });

  function handleEditar(proveedor: Proveedor) {
    setEditingId(proveedor.id);
    setForm({
      nombre: proveedor.nombre,
      cuit: proveedor.cuit ?? "",
      contactoNombre: proveedor.contactoNombre ?? "",
      telefono: proveedor.telefono ?? "",
      email: proveedor.email ?? "",
      direccion: proveedor.direccion ?? "",
      condicionesPago: proveedor.condicionesPago ?? "",
      activo: proveedor.activo,
    });
    setError(null);
  }

  function handleCancelar() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) guardar.mutate();
    else crear.mutate();
  }

  const guardando = crear.isPending || guardar.isPending;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-on-surface">{t("suppliers.title")}</h1>
      <p className="mb-6 text-sm text-on-surface-variant">{t("suppliers.subtitle")}</p>

      <form
        onSubmit={handleSubmit}
        className="mb-8 grid max-w-3xl grid-cols-1 gap-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6 sm:grid-cols-2"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">{t("suppliers.name")}</label>
          <input
            required
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("suppliers.cuit")}</label>
          <input
            value={form.cuit}
            onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value }))}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("suppliers.contact")}</label>
          <input
            value={form.contactoNombre}
            onChange={(e) => setForm((f) => ({ ...f, contactoNombre: e.target.value }))}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("suppliers.phone")}</label>
          <input
            value={form.telefono}
            onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("suppliers.email")}</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("suppliers.address")}</label>
          <input
            value={form.direccion}
            onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("suppliers.paymentTerms")}</label>
          <input
            value={form.condicionesPago}
            onChange={(e) => setForm((f) => ({ ...f, condicionesPago: e.target.value }))}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        {editingId && (
          <div className="flex items-center">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                className="h-4 w-4 rounded border-outline-variant"
              />
              {t("suppliers.activeLabel")}
            </label>
          </div>
        )}

        {error && <p className="sm:col-span-2 text-sm text-error">{error}</p>}

        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={guardando}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
          >
            {editingId ? <Pencil size={16} /> : <Truck size={16} />}
            {editingId ? t("users.saveChanges") : t("suppliers.create")}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={handleCancelar}
              className="flex items-center gap-2 rounded-md border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant"
            >
              <X size={16} />
              {t("common.cancel")}
            </button>
          )}
        </div>
      </form>

      <ResponsiveTable
        columns={[
          { key: "nombre", header: t("suppliers.name"), cell: (p) => <span className="font-medium">{p.nombre}</span> },
          {
            key: "contacto",
            header: t("suppliers.contact"),
            cell: (p) => <span className="text-on-surface-variant">{p.contactoNombre ?? "—"}</span>,
            hideOnCard: true,
          },
          {
            key: "telefono",
            header: t("suppliers.phone"),
            cell: (p) => <span className="text-on-surface-variant">{p.telefono ?? "—"}</span>,
          },
          {
            key: "estado",
            header: t("users.status"),
            cell: (p) => (
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  p.activo ? "bg-secondary-container text-on-secondary-container" : "bg-expired-soft text-expired-text"
                }`}
              >
                {p.activo ? t("users.active") : t("users.inactive")}
              </span>
            ),
          },
          {
            key: "acciones",
            header: t("users.actions"),
            cell: (p) => (
              <button
                onClick={() => handleEditar(p)}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Pencil size={14} />
                {t("users.edit")}
              </button>
            ),
          },
        ]}
        data={proveedores}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        loadingLabel={t("common.loading")}
        emptyLabel={t("suppliers.empty")}
      />
    </div>
  );
}
