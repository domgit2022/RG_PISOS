import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Ban, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { ProductPicker } from "@/components/ProductPicker";
import type { Almacen, ListaPrecio, MedioPago, PrecioListado, Producto, Venta } from "@/lib/types";

interface ItemCarrito {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export function SalesPage() {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [anulando, setAnulando] = useState<Venta | null>(null);

  const { data: ventas, isLoading } = useQuery({
    queryKey: ["ventas"],
    queryFn: async () => (await apiClient.get<Venta[]>("/ventas")).data,
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">{t("sales.title")}</h1>
          <p className="text-sm text-on-surface-variant">{t("sales.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
        >
          <Plus size={16} />
          {t("sales.newSale")}
        </button>
      </div>

      {showForm && <NewSaleForm onDone={() => setShowForm(false)} />}
      {anulando && <CancelSaleModal venta={anulando} onDone={() => setAnulando(null)} />}

      <ResponsiveTable
        columns={[
          {
            key: "fecha",
            header: t("sales.date"),
            cell: (v) => <span className="font-data">{new Date(v.fecha).toLocaleString()}</span>,
          },
          {
            key: "vendedor",
            header: t("sales.seller"),
            cell: (v) => v.usuario.nombreCompleto,
            hideOnCard: true,
          },
          {
            key: "total",
            header: t("sales.total"),
            cell: (v) => <span className="font-data font-semibold">${Number(v.total).toFixed(2)}</span>,
          },
          {
            key: "estado",
            header: t("sales.status"),
            cell: (v) => (
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  v.estado === "CONFIRMADA"
                    ? "bg-secondary-container text-on-secondary-container"
                    : "bg-expired-soft text-expired-text"
                }`}
              >
                {v.estado === "CONFIRMADA" ? t("sales.confirmed") : t("sales.cancelled")}
              </span>
            ),
          },
          {
            key: "acciones",
            header: t("users.actions"),
            cell: (v) =>
              v.estado === "CONFIRMADA" && (
                <button
                  onClick={() => setAnulando(v)}
                  className="flex items-center gap-1 text-sm font-medium text-error hover:underline"
                >
                  <Ban size={14} />
                  {t("sales.cancel")}
                </button>
              ),
          },
        ]}
        data={ventas}
        rowKey={(v) => v.id}
        isLoading={isLoading}
        loadingLabel={t("common.loading")}
        emptyLabel={t("sales.empty")}
      />
    </div>
  );
}

function NewSaleForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: listas } = useQuery({
    queryKey: ["listas-precio"],
    queryFn: async () => (await apiClient.get<ListaPrecio[]>("/catalogos/listas-precio")).data,
  });
  const { data: almacenes } = useQuery({
    queryKey: ["almacenes"],
    queryFn: async () => (await apiClient.get<Almacen[]>("/catalogos/almacenes")).data,
  });
  const { data: mediosPago } = useQuery({
    queryKey: ["medios-pago"],
    queryFn: async () => (await apiClient.get<MedioPago[]>("/catalogos/medios-pago")).data,
  });
  const { data: productos } = useQuery({
    queryKey: ["productos-todos"],
    queryFn: async () => (await apiClient.get<{ items: Producto[] }>("/productos", { params: { pageSize: 100 } })).data.items,
  });

  const [listaPrecioId, setListaPrecioId] = useState("");
  const [almacenId, setAlmacenId] = useState("");
  const [medioPagoId, setMedioPagoId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: precios } = useQuery({
    queryKey: ["precios", listaPrecioId],
    queryFn: async () => (await apiClient.get<PrecioListado[]>("/precios", { params: { listaPrecioId } })).data,
    enabled: !!listaPrecioId,
  });

  function agregarItem() {
    const producto = productos?.find((p) => p.id === productoId);
    const precioInfo = precios?.find((p) => p.id === productoId);
    const precioVigente = precioInfo?.precioVigente;
    if (!producto || !precioVigente) {
      setError(t("pricing.noPrice"));
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        productoId,
        nombre: producto.nombre,
        cantidad: Number(cantidad),
        precioUnitario: Number(precioVigente.precio),
      },
    ]);
    setProductoId("");
    setCantidad("1");
    setError(null);
  }

  const total = items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);

  const confirmar = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post("/ventas", {
          listaPrecioId,
          almacenId,
          medioPagoId,
          items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] });
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      onDone();
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("sales.saleError")),
  });

  return (
    <div className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6">
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("sales.priceList")}</label>
          <select
            value={listaPrecioId}
            onChange={(e) => {
              setListaPrecioId(e.target.value);
              setItems([]);
            }}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="" disabled>
              {t("sales.priceList")}
            </option>
            {listas?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("sales.warehouse")}</label>
          <select
            value={almacenId}
            onChange={(e) => setAlmacenId(e.target.value)}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="" disabled>
              {t("sales.warehouse")}
            </option>
            {almacenes?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("sales.paymentMethod")}</label>
          <select
            value={medioPagoId}
            onChange={(e) => setMedioPagoId(e.target.value)}
            className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="" disabled>
              {t("sales.paymentMethod")}
            </option>
            {mediosPago?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {listaPrecioId && (
        <div className="mb-4 flex flex-wrap items-end gap-2 border-t border-outline-variant/30 pt-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">{t("sales.product")}</label>
            <ProductPicker
              productos={productos}
              value={productoId}
              onChange={setProductoId}
              placeholder="Buscar por número o descripción..."
            />
          </div>
          <div className="w-28">
            <label className="mb-1 block text-sm font-medium">{t("sales.quantity")}</label>
            <input
              type="number"
              min={0.001}
              step="0.001"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={agregarItem}
            disabled={!productoId}
            className="rounded-md border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant disabled:opacity-50"
          >
            {t("sales.addItem")}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs uppercase text-on-surface-variant">
            <tr>
              <th className="py-1">{t("sales.product")}</th>
              <th className="py-1">{t("sales.quantity")}</th>
              <th className="py-1">{t("sales.unitPrice")}</th>
              <th className="py-1">{t("sales.subtotal")}</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-t border-outline-variant/30">
                <td className="py-2">{item.nombre}</td>
                <td className="py-2 font-data">{item.cantidad}</td>
                <td className="py-2 font-data">${item.precioUnitario.toFixed(2)}</td>
                <td className="py-2 font-data">${(item.cantidad * item.precioUnitario).toFixed(2)}</td>
                <td className="py-2">
                  <button onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="text-error">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {items.length > 0 && (
        <p className="mb-4 text-right text-lg font-semibold">
          {t("sales.total")}: <span className="font-data">${total.toFixed(2)}</span>
        </p>
      )}

      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={() => confirmar.mutate()}
          disabled={items.length === 0 || !almacenId || !medioPagoId || confirmar.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
        >
          {t("sales.confirmSale")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex items-center gap-2 rounded-md border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant"
        >
          <X size={16} />
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function CancelSaleModal({ venta, onDone }: { venta: Venta; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const anular = useMutation({
    mutationFn: async () => (await apiClient.post(`/ventas/${venta.id}/anular`, { motivo })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] });
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      onDone();
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("sales.saleError")),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-white/10 bg-surface-container-lowest shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-outline-variant/30 bg-gradient-to-r from-primary/10 via-surface-container-lowest to-transparent p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/40 bg-error/10 text-error">
              <Ban size={20} />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-on-surface-variant">{t("sales.cancel")}</p>
              <h2 className="mt-1 text-xl font-semibold text-on-surface">${Number(venta.total).toFixed(2)}</h2>
              <p className="mt-1 font-data text-xs text-on-surface-variant">{new Date(venta.fecha).toLocaleString()}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDone}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            anular.mutate();
          }}
          className="overflow-y-auto p-6"
        >
          <label className="mb-1 block text-sm font-medium">{t("sales.cancelReason")}</label>
          <input
            required
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="mb-4 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          {error && <p className="mb-4 text-sm text-error">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={anular.isPending}
              className="flex items-center gap-2 rounded-md bg-error px-4 py-2 text-sm font-medium text-on-error disabled:opacity-60"
            >
              <Ban size={16} />
              {t("sales.cancelConfirm")}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="flex items-center gap-2 rounded-md border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant"
            >
              <X size={16} />
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
