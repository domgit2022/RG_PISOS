import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Pencil, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import type { Rol, Usuario } from "@/lib/types";

const emptyForm = {
  nombreCompleto: "",
  username: "",
  email: "",
  password: "",
  rolId: "",
  activo: true,
  recibeAvisosVencimiento: false,
};

export function UsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => (await apiClient.get<Usuario[]>("/usuarios")).data,
  });
  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await apiClient.get<Rol[]>("/roles")).data,
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function extraerError(err: unknown, fallback: string) {
    return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
  }

  const crearUsuario = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<Usuario>("/usuarios", {
          ...form,
          email: form.email.trim() || undefined,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      setForm({ ...emptyForm, rolId: form.rolId });
      setError(null);
    },
    onError: (err: unknown) => setError(extraerError(err, t("users.createError"))),
  });

  const guardarUsuario = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        nombreCompleto: form.nombreCompleto,
        username: form.username,
        email: form.email.trim() || null,
        rolId: form.rolId,
        activo: form.activo,
        recibeAvisosVencimiento: form.recibeAvisosVencimiento,
      };
      if (form.password) payload.password = form.password;
      return (await apiClient.put<Usuario>(`/usuarios/${editingId}`, payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      handleCancelar();
    },
    onError: (err: unknown) => setError(extraerError(err, t("users.updateError"))),
  });

  function handleEditar(usuario: Usuario) {
    setEditingId(usuario.id);
    setForm({
      nombreCompleto: usuario.nombreCompleto,
      username: usuario.username,
      email: usuario.email ?? "",
      password: "",
      rolId: usuario.rol.id,
      activo: usuario.activo,
      recibeAvisosVencimiento: usuario.recibeAvisosVencimiento,
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
    if (!form.rolId) {
      setError(t("users.roleRequired"));
      return;
    }
    if (editingId) {
      guardarUsuario.mutate();
    } else {
      crearUsuario.mutate();
    }
  }

  const guardando = crearUsuario.isPending || guardarUsuario.isPending;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-on-surface">{t("users.title")}</h1>
      <p className="mb-6 text-sm text-on-surface-variant">{t("users.subtitle")}</p>

      <form
        onSubmit={handleSubmit}
        className="mb-8 grid max-w-2xl grid-cols-1 gap-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6 sm:grid-cols-2"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">{t("users.fullName")}</label>
          <input
            required
            value={form.nombreCompleto}
            onChange={(e) => setForm((f) => ({ ...f, nombreCompleto: e.target.value }))}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("users.username")}</label>
          <input
            required
            placeholder="usuario"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("users.email")}</label>
          <input
            type="email"
            placeholder="usuario@miempresa.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <p className="mt-1 text-xs text-on-surface-variant">{t("users.emailHint")}</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("users.password")}</label>
          <input
            required={!editingId}
            type="password"
            minLength={8}
            placeholder={editingId ? t("users.passwordEditHint") : undefined}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("users.role")}</label>
          <select
            required
            value={form.rolId}
            onChange={(e) => setForm((f) => ({ ...f, rolId: e.target.value }))}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="" disabled>
              {t("users.selectRole")}
            </option>
            {roles?.map((rol) => (
              <option key={rol.id} value={rol.id}>
                {rol.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.recibeAvisosVencimiento}
              onChange={(e) => setForm((f) => ({ ...f, recibeAvisosVencimiento: e.target.checked }))}
              className="h-4 w-4 rounded border-outline-variant"
            />
            {t("users.expiryReminders")}
          </label>
        </div>
        {editingId && (
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                className="h-4 w-4 rounded border-outline-variant"
              />
              {t("users.activeLabel")}
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
            {editingId ? <Pencil size={16} /> : <UserPlus size={16} />}
            {editingId ? t("users.saveChanges") : t("users.create")}
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
          { key: "nombre", header: t("users.fullName"), cell: (u) => <span className="font-medium">{u.nombreCompleto}</span> },
          { key: "username", header: t("users.username"), cell: (u) => <span className="font-data">{u.username}</span> },
          {
            key: "email",
            header: t("users.email"),
            cell: (u) => <span className="text-on-surface-variant">{u.email ?? "—"}</span>,
            hideOnCard: true,
          },
          {
            key: "rol",
            header: t("users.role"),
            cell: (u) => <span className="text-on-surface-variant">{u.rol.nombre}</span>,
          },
          {
            key: "avisosVencimiento",
            header: t("users.expiryReminders"),
            cell: (u) => <span className="text-on-surface-variant">{u.recibeAvisosVencimiento ? t("common.yes") : t("common.no")}</span>,
            hideOnCard: true,
          },
          {
            key: "estado",
            header: t("users.status"),
            cell: (u) => (
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  u.activo ? "bg-secondary-container text-on-secondary-container" : "bg-expired-soft text-expired-text"
                }`}
              >
                {u.activo ? t("users.active") : t("users.inactive")}
              </span>
            ),
          },
          {
            key: "acciones",
            header: t("users.actions"),
            cell: (u) => (
              <button
                onClick={() => handleEditar(u)}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Pencil size={14} />
                {t("users.edit")}
              </button>
            ),
          },
        ]}
        data={usuarios}
        rowKey={(u) => u.id}
        isLoading={isLoading}
        loadingLabel={t("common.loading")}
        emptyLabel={t("users.empty")}
      />
    </div>
  );
}
