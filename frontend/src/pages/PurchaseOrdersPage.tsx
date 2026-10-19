import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, PackageCheck, Ban, X, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { ProductPicker } from "@/components/ProductPicker";
import type { Almacen, OrdenCompra, Producto, Proveedor } from "@/lib/types";

interface ItemOrden {
  productoId: string;
  nombre: string;
  cantidadPedida: number;
  costoUnitarioPactado: number;
}

const estadoLabelKey: Record<OrdenCompra["estado"], string> = {
  PENDIENTE: "purchaseOrders.pending",
  RECIBIDA_PARCIAL: "purchaseOrders.partial",
  RECIBIDA_COMPLETA: "purchaseOrders.complete",
  CANCELADA: "purchaseOrders.cancelled",
};

const estadoClases: Record<OrdenCompra["estado"], string> = {
  PENDIENTE: "bg-amber-100 text-stock-low",
  RECIBIDA_PARCIAL: "bg-surface-container text-on-surface-variant",
  RECIBIDA_COMPLETA: "bg-secondary-container text-on-secondary-container",
  CANCELADA: "bg-expired-soft text-expired-text",
};

export function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [recibiendo, setRecibiendo] = useState<OrdenCompra | null>(null);

  const { data: ordenes, isLoading } = useQuery({
    queryKey: ["ordenes-compra"],
    queryFn: async () => (await apiClient.get<OrdenCompra[]>("/ordenes-compra")).data,
  });

  const cancelar = useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/ordenes-compra/${id}/cancelar`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ordenes-compra"] }),
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">{t("purchaseOrders.title")}</h1>
          <p className="text-sm text-on-surface-variant">{t("purchaseOrders.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
        >
          <Plus size={16} />
          {t("purchaseOrders.newOrder")}
        </button>
      </div>

      {showForm && <NewOrderForm onDone={() => setShowForm(false)} />}
      {recibiendo && <ReceiveOrderModal orden={recibiendo} onDone={() => setRecibiendo(null)} />}

      <ResponsiveTable
        columns={[
          { key: "proveedor", header: t("purchaseOrders.supplier"), cell: (o) => <span className="font-medium">{o.proveedor.nombre}</span> },
          {
            key: "fecha",
            header: t("sales.date"),
            cell: (o) => <span className="font-data">{new Date(o.fecha).toLocaleDateString()}</span>,
          },
          {
            key: "estado",
            header: t("purchaseOrders.status"),
            cell: (o) => (
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${estadoClases[o.estado]}`}>
                {t(estadoLabelKey[o.estado])}
              </span>
            ),
          },
          {
            key: "acciones",
            header: t("users.actions"),
            cell: (o) => (
              <div className="flex items-center gap-3">
                {(o.estado === "PENDIENTE" || o.estado === "RECIBIDA_PARCIAL") && (
                  <>
                    <button
                      onClick={() => setRecibiendo(o)}
                      className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <PackageCheck size={14} />
                      {t("purchaseOrders.receive")}
                    </button>
                    {o.estado === "PENDIENTE" && (
                      <button
                        onClick={() => cancelar.mutate(o.id)}
                        className="flex items-center gap-1 text-sm font-medium text-error hover:underline"
                      >
                        <Ban size={14} />
                        {t("purchaseOrders.cancelOrder")}
                      </button>
                    )}
                  </>
                )}
              </div>
            ),
          },
        ]}
        data={ordenes}
        rowKey={(o) => o.id}
        isLoading={isLoading}
        loadingLabel={t("common.loading")}
        emptyLabel={t("purchaseOrders.empty")}
      />
    </div>
  );
}

function NewOrderForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: proveedores } = useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => (await apiClient.get<Proveedor[]>("/proveedores")).data,
  });
  const { data: productos } = useQuery({
    queryKey: ["productos-todos"],
    queryFn: async () => (await apiClient.get<{ items: Producto[] }>("/productos", { params: { pageSize: 100 } })).data.items,
  });

  const [proveedorId, setProveedorId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [costo, setCosto] = useState("");
  const [items, setItems] = useState<ItemOrden[]>([]);
  const [error, setError] = useState<string | null>(null);

  function agregarItem() {
    const producto = productos?.find((p) => p.id === productoId);
    if (!producto || !costo) return;
    setItems((prev) => [
      ...prev,
      { productoId, nombre: producto.nombre, cantidadPedida: Number(cantidad), costoUnitarioPactado: Number(costo) },
    ]);
    setProductoId("");
    setCantidad("1");
    setCosto("");
  }

  const crear = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post("/ordenes-compra", {
          proveedorId,
          items: items.map((i) => ({
            productoId: i.productoId,
            cantidadPedida: i.cantidadPedida,
            costoUnitarioPactado: i.costoUnitarioPactado,
          })),
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordenes-compra"] });
      onDone();
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("purchaseOrders.createError")),
  });

  return (
    <div className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6">
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium">{t("purchaseOrders.supplier")}</label>
        <select
          value={proveedorId}
          onChange={(e) => setProveedorId(e.target.value)}
          className="w-full max-w-sm rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="" disabled>
            {t("purchaseOrders.supplier")}
          </option>
          {proveedores?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      {proveedorId && (
        <div className="mb-4 flex flex-wrap items-end gap-2 border-t border-outline-variant/30 pt-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">{t("purchaseOrders.product")}</label>
            <ProductPicker
              productos={productos}
              value={productoId}
              onChange={setProductoId}
              placeholder="Buscar por número o descripción..."
            />
          </div>
          <div className="w-28">
            <label className="mb-1 block text-sm font-medium">{t("purchaseOrders.quantity")}</label>
            <input
              type="number"
              min={0.001}
              step="0.001"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="w-32">
            <label className="mb-1 block text-sm font-medium">{t("purchaseOrders.unitCost")}</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={agregarItem}
            disabled={!productoId || !costo}
            className="rounded-md border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant disabled:opacity-50"
          >
            {t("purchaseOrders.addItem")}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-left text-xs uppercase text-on-surface-variant">
            <tr>
              <th className="py-1">{t("purchaseOrders.product")}</th>
              <th className="py-1">{t("purchaseOrders.quantity")}</th>
              <th className="py-1">{t("purchaseOrders.unitCost")}</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-t border-outline-variant/30">
                <td className="py-2">{item.nombre}</td>
                <td className="py-2 font-data">{item.cantidadPedida}</td>
                <td className="py-2 font-data">${item.costoUnitarioPactado.toFixed(2)}</td>
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

      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={() => crear.mutate()}
          disabled={items.length === 0 || crear.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
        >
          {t("purchaseOrders.create")}
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

function ReceiveOrderModal({ orden, onDone }: { orden: OrdenCompra; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: almacenes } = useQuery({
    queryKey: ["almacenes"],
    queryFn: async () => (await apiClient.get<Almacen[]>("/catalogos/almacenes")).data,
  });
  const pendientes = orden.detalles.filter((d) => Number(d.cantidadRecibida) < Number(d.cantidadPedida));

  const [almacenId, setAlmacenId] = useState("");
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [lotes, setLotes] = useState<Record<string, { numeroLote: string; fechaVencimiento: string }>>({});
  const [error, setError] = useState<string | null>(null);

  const recibir = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post(`/ordenes-compra/${orden.id}/recibir`, {
          items: pendientes
            .filter((d) => Number(cantidades[d.id] ?? 0) > 0)
            .map((d) => ({
              detalleId: d.id,
              cantidadRecibida: Number(cantidades[d.id]),
              almacenId,
              numeroLote: lotes[d.id]?.numeroLote || null,
              fechaVencimiento: lotes[d.id]?.fechaVencimiento || null,
            })),
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordenes-compra"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      onDone();
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("purchaseOrders.receiveError")),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-hidden rounded-[28px] border border-white/10 bg-surface-container-lowest shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/30 bg-gradient-to-r from-primary/10 via-surface-container-lowest to-transparent p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/40 bg-primary/10 text-primary">
              <PackageCheck size={20} />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-on-surface-variant">{t("purchaseOrders.receive")}</p>
              <h2 className="mt-1 text-xl font-semibold text-on-surface">{t("purchaseOrders.receiveTitle")}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">{orden.proveedor.nombre}</p>
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

        <div className="max-h-[75vh] overflow-y-auto p-6">
          <label className="mb-1 block text-sm font-medium">{t("purchaseOrders.warehouse")}</label>
          <select
            value={almacenId}
            onChange={(e) => setAlmacenId(e.target.value)}
            className="mb-4 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="" disabled>
              {t("purchaseOrders.warehouse")}
            </option>
            {almacenes?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>

          <div className="space-y-3">
            {pendientes.map((detalle) => {
              const pendiente = Number(detalle.cantidadPedida) - Number(detalle.cantidadRecibida);
              return (
                <div key={detalle.id} className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                  <p className="mb-3 text-sm font-medium text-on-surface">
                    {detalle.producto.nombre}{" "}
                    <span className="font-normal text-on-surface-variant">
                      — {t("purchaseOrders.pendingQty")}: {pendiente}
                    </span>
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      type="number"
                      min={0}
                      max={pendiente}
                      step="0.001"
                      placeholder={t("purchaseOrders.receiveQty")}
                      value={cantidades[detalle.id] ?? ""}
                      onChange={(e) => setCantidades((c) => ({ ...c, [detalle.id]: e.target.value }))}
                      className="rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                    <input
                      placeholder={t("purchaseOrders.batchNumber")}
                      value={lotes[detalle.id]?.numeroLote ?? ""}
                      onChange={(e) =>
                        setLotes((l) => ({ ...l, [detalle.id]: { ...l[detalle.id], numeroLote: e.target.value, fechaVencimiento: l[detalle.id]?.fechaVencimiento ?? "" } }))
                      }
                      className="rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                    <input
                      type="date"
                      placeholder={t("purchaseOrders.expiryDate")}
                      value={lotes[detalle.id]?.fechaVencimiento ?? ""}
                      onChange={(e) =>
                        setLotes((l) => ({ ...l, [detalle.id]: { ...l[detalle.id], fechaVencimiento: e.target.value, numeroLote: l[detalle.id]?.numeroLote ?? "" } }))
                      }
                      className="rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p className="mt-4 text-sm text-error">{error}</p>}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => recibir.mutate()}
              disabled={!almacenId || recibir.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
            >
              <PackageCheck size={16} />
              {t("purchaseOrders.confirmReceive")}
            </button>
            <button
              onClick={onDone}
              className="flex items-center gap-2 rounded-md border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant"
            >
              <X size={16} />
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
