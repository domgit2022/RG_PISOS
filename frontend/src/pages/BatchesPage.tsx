import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, SlidersHorizontal, History, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { ProductPicker } from "@/components/ProductPicker";
import { CargaStockForm, StockProducto } from "@/components/StockProducto";
import type { Lote, MovimientoStock, Producto } from "@/lib/types";

interface ResumenStock {
  productoId: string;
  nombre: string;
  sku: string;
  unidad: string;
  controlaLote: boolean;
  controlaVencimiento: boolean;
  total: number;
  aReponer: boolean;
  porAlmacen: { almacen: string; cantidad: number }[];
  proximoVencimiento: string | null;
  estado: Lote["estado"];
}

type Filtro = "todos" | "con-stock" | "sin-stock" | "por-vencer" | "vencidos";

const formatoCantidad = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n);

function EstadoBadge({ fila }: { fila: ResumenStock }) {
  const [texto, clases] =
    fila.total <= 0
      ? ["Sin stock", "bg-expired-soft text-expired-text"]
      : fila.estado === "VENCIDO"
        ? ["Vencido", "bg-expired-soft text-expired-text"]
        : fila.estado === "POR_VENCER"
          ? ["Por vencer", "bg-amber-100 text-stock-low"]
          : fila.aReponer
            ? ["A reponer", "bg-amber-100 text-stock-low"]
            : ["OK", "bg-secondary-container text-on-secondary-container"];
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${clases}`}>{texto}</span>;
}

/**
 * Pantalla Stock: primer nivel por material (disponible total, por almacén y
 * próximo vencimiento); al tocar un material se abre la apertura por lote y
 * almacén, donde se carga y ajusta stock según lo que controle el material.
 */
export function BatchesPage() {
  const { t } = useTranslation();
  const [showIngreso, setShowIngreso] = useState(false);
  const [detalle, setDetalle] = useState<ResumenStock | null>(null);
  const [ajustandoLote, setAjustandoLote] = useState<Lote | null>(null);
  const [kardexProductoId, setKardexProductoId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const { data: resumen, isLoading } = useQuery({
    queryKey: ["stock-resumen"],
    queryFn: async () => (await apiClient.get<ResumenStock[]>("/stock/resumen")).data,
  });

  const filas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resumen?.filter((f) => {
      if (q && !f.nombre.toLowerCase().includes(q) && !f.sku.toLowerCase().includes(q)) return false;
      if (filtro === "con-stock") return f.total > 0;
      if (filtro === "sin-stock") return f.total <= 0;
      if (filtro === "por-vencer") return f.total > 0 && f.estado === "POR_VENCER";
      if (filtro === "vencidos") return f.total > 0 && f.estado === "VENCIDO";
      return true;
    });
  }, [resumen, search, filtro]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">{t("batches.title")}</h1>
          <p className="text-sm text-on-surface-variant">{t("batches.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowIngreso((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
        >
          <Plus size={16} />
          Cargar stock
        </button>
      </div>

      {showIngreso && <IngresoForm onDone={() => setShowIngreso(false)} />}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2">
          <Search size={16} className="text-on-surface-variant" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número o descripción..."
            className="w-full text-sm outline-none"
          />
        </div>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as Filtro)}
          className="rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="todos">Todos</option>
          <option value="con-stock">Con stock</option>
          <option value="sin-stock">Sin stock</option>
          <option value="por-vencer">Por vencer</option>
          <option value="vencidos">Vencidos</option>
        </select>
      </div>

      <ResponsiveTable
        columns={[
          {
            key: "producto",
            header: t("batches.product"),
            cell: (f) => (
              <div>
                <p className="font-medium">{f.nombre}</p>
                <p className="font-data text-xs text-on-surface-variant">{f.sku}</p>
              </div>
            ),
          },
          {
            key: "disponible",
            header: "Disponible",
            cell: (f) => (
              <span className="font-data font-medium">
                {formatoCantidad(f.total)} <span className="font-normal text-on-surface-variant">{f.unidad}</span>
              </span>
            ),
          },
          {
            key: "almacenes",
            header: "Por almacén",
            hideOnCard: true,
            cell: (f) =>
              f.porAlmacen.length ? (
                <span className="text-on-surface-variant">
                  {f.porAlmacen.map((a) => `${a.almacen}: ${formatoCantidad(a.cantidad)}`).join(" · ")}
                </span>
              ) : (
                "—"
              ),
          },
          {
            key: "vencimiento",
            header: "Próx. vencimiento",
            cell: (f) => (
              <span className="font-data">
                {f.proximoVencimiento ? new Date(f.proximoVencimiento).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—"}
              </span>
            ),
          },
          { key: "estado", header: t("batches.status"), cell: (f) => <EstadoBadge fila={f} /> },
        ]}
        data={filas}
        rowKey={(f) => f.productoId}
        isLoading={isLoading}
        loadingLabel={t("common.loading")}
        emptyLabel={t("batches.empty")}
        onRowClick={setDetalle}
      />

      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={() => setDetalle(null)}>
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-surface-container-lowest shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant/30 p-6">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-on-surface-variant">Stock por almacén y lote</p>
                <h2 className="mt-1 text-xl font-semibold text-on-surface">{detalle.nombre}</h2>
                <p className="mt-1 font-data text-sm text-on-surface-variant">
                  {detalle.sku}
                  {detalle.controlaLote && " · Control por lote"}
                  {detalle.controlaVencimiento && " · Controla vencimiento"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setKardexProductoId(detalle.productoId)}
                  className="flex items-center gap-2 rounded-full border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant hover:text-primary"
                >
                  <History size={16} />
                  Movimientos
                </button>
                <button
                  type="button"
                  onClick={() => setDetalle(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-6">
              <StockProducto
                producto={{
                  id: detalle.productoId,
                  controlaLote: detalle.controlaLote,
                  controlaVencimiento: detalle.controlaVencimiento,
                  unidadMedida: { codigo: detalle.unidad },
                }}
                onAjustar={setAjustandoLote}
              />
            </div>
          </div>
        </div>
      )}

      {ajustandoLote && <AjusteForm lote={ajustandoLote} onDone={() => setAjustandoLote(null)} />}
      {kardexProductoId && <KardexPanel productoId={kardexProductoId} onClose={() => setKardexProductoId(null)} />}
    </div>
  );
}

function IngresoForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { data: productos } = useQuery({
    queryKey: ["productos-todos"],
    queryFn: async () => (await apiClient.get<{ items: Producto[] }>("/productos", { params: { pageSize: 100 } })).data.items,
  });
  const [productoId, setProductoId] = useState("");
  const producto = productos?.find((p) => p.id === productoId);

  return (
    <div className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6">
      <div className="mb-4 max-w-xl">
        <label className="mb-1 block text-sm font-medium">{t("batches.product")}</label>
        <ProductPicker
          productos={productos}
          value={productoId}
          onChange={setProductoId}
          placeholder="Buscar por número o descripción..."
        />
      </div>
      {producto ? (
        <CargaStockForm key={producto.id} producto={producto} onCancel={onDone} conProveedor />
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onDone}
            className="flex items-center gap-2 rounded-md border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant"
          >
            <X size={16} />
            {t("common.cancel")}
          </button>
        </div>
      )}
    </div>
  );
}

function AjusteForm({ lote, onDone }: { lote: Lote; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<"AJUSTE" | "MERMA">("AJUSTE");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const registrar = useMutation({
    mutationFn: async () =>
      (await apiClient.post("/stock/movimiento", { loteId: lote.id, tipo, cantidad: Number(cantidad), motivo })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      queryClient.invalidateQueries({ queryKey: ["lotes-producto"] });
      queryClient.invalidateQueries({ queryKey: ["stock-resumen"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      onDone();
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("batches.adjustError")),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-white/10 bg-surface-container-lowest shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-outline-variant/30 bg-gradient-to-r from-primary/10 via-surface-container-lowest to-transparent p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/40 bg-primary/10 text-primary">
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-on-surface-variant">{t("batches.adjust")}</p>
              <h2 className="mt-1 text-xl font-semibold text-on-surface">{t("batches.adjustTitle")}</h2>
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

        <div className="overflow-y-auto p-6">
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="col-span-2 rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">{t("batches.product")}</p>
              <p className="mt-1 font-medium text-on-surface">{lote.producto.nombre}</p>
              <p className="font-data text-xs text-on-surface-variant">{lote.producto.sku}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">{t("batches.warehouse")}</p>
              <p className="mt-1 text-on-surface">{lote.almacen.nombre}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">Ubicación</p>
              <p className="mt-1 text-on-surface">{lote.ubicacion?.nombre ?? "—"}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">{t("batches.currentQty")}</p>
              <p className="mt-1 text-lg font-semibold text-on-surface">{lote.cantidadActual}</p>
            </div>
            {lote.producto.controlaLote && (
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">{t("batches.batchNumber")}</p>
                <p className="mt-1 font-data text-on-surface">{lote.numeroLote ?? "—"}</p>
              </div>
            )}
            {lote.producto.controlaVencimiento && (
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">{t("batches.expiryDate")}</p>
                <p className="mt-1 font-data text-on-surface">
                  {lote.fechaVencimiento ? new Date(lote.fechaVencimiento).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—"}
                </p>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!motivo.trim()) {
                setError(t("batches.reasonRequired"));
                return;
              }
              registrar.mutate();
            }}
          >
            <label className="mb-1 block text-sm font-medium">{t("batches.movementType")}</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "AJUSTE" | "MERMA")}
              className="mb-4 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="AJUSTE">{t("batches.adjustment")}</option>
              <option value="MERMA">{t("batches.loss")}</option>
            </select>

            <label className="mb-1 block text-sm font-medium">{t("batches.quantity")}</label>
            <input
              required
              type="number"
              step="0.001"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder={tipo === "AJUSTE" ? "Ej: 5 o -3" : "Ej: 2"}
              className="mb-1 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <p className="mb-4 text-xs text-on-surface-variant">
              {tipo === "AJUSTE"
                ? "Positivo para sumar stock, negativo para restar."
                : "Cantidad que se pierde o descarta (siempre resta stock)."}
            </p>

            <label className="mb-1 block text-sm font-medium">{t("batches.reason")}</label>
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
                disabled={registrar.isPending}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
              >
                <SlidersHorizontal size={16} />
                {t("batches.confirmAdjust")}
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
    </div>
  );
}

function KardexPanel({ productoId, onClose }: { productoId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: movimientos, isLoading } = useQuery({
    queryKey: ["movimientos", productoId],
    queryFn: async () =>
      (await apiClient.get<MovimientoStock[]>("/stock/movimientos", { params: { productoId } })).data,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/10 bg-surface-container-lowest shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 bg-gradient-to-r from-primary/10 via-surface-container-lowest to-transparent p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/40 bg-primary/10 text-primary">
              <History size={20} />
            </div>
            <h2 className="text-xl font-semibold text-on-surface">{t("batches.kardexTitle")}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-6">
          {isLoading && <p className="text-sm text-on-surface-variant">{t("common.loading")}</p>}
          {!isLoading && movimientos?.length === 0 && (
            <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container p-6 text-center text-sm text-on-surface-variant">
              {t("batches.noMovements")}
            </div>
          )}
          <ul className="space-y-2">
            {movimientos?.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-2xl border border-outline-variant/40 bg-surface-container p-4 text-sm"
              >
                <div>
                  <p className="font-medium text-on-surface">{m.tipo}</p>
                  <p className="font-data text-xs text-on-surface-variant">
                    {new Date(m.fecha).toLocaleString()} · {m.usuario.nombreCompleto}
                  </p>
                  {m.lote.numeroLote && (
                    <p className="font-data text-xs text-on-surface-variant">Lote: {m.lote.numeroLote}</p>
                  )}
                  {m.motivo && <p className="mt-1 text-xs text-on-surface-variant">{m.motivo}</p>}
                </div>
                <div className="text-right">
                  <p className={`font-data font-medium ${Number(m.cantidad) < 0 ? "text-error" : "text-secondary"}`}>
                    {Number(m.cantidad) > 0 ? "+" : ""}
                    {m.cantidad}
                  </p>
                  <p className="font-data text-xs text-on-surface-variant">= {m.stockResultante}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
