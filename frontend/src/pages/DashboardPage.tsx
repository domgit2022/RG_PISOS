import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Wallet, AlertTriangle, Clock, Boxes, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { StatCard } from "@/components/StatCard";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import type { DetalleLotePorVencer, DetalleProductoPanel, ResumenDashboard } from "@/lib/types";

type TipoDetalle = "reponer" | "vencer" | "activos";

export function DashboardPage() {
  const { t } = useTranslation();
  const [detalle, setDetalle] = useState<TipoDetalle | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-resumen"],
    queryFn: async () => (await apiClient.get<ResumenDashboard>("/dashboard/resumen")).data,
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">{t("dashboard.title")}</h1>
          <p className="text-sm text-on-surface-variant">{t("dashboard.subtitle")}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">{t("common.loading")}</p>
      ) : isError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-outline-variant/40 bg-surface-container px-4 py-3 text-sm">
          <span className="text-on-surface-variant">No se pudieron cargar los indicadores.</span>
          <button type="button" onClick={() => void refetch()} className="font-medium text-primary hover:underline">
            Reintentar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Wallet}
            label={t("dashboard.inventoryValue")}
            value={new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(
              data?.valorInventario ?? 0
            )}
          />
          <StatCard
            icon={AlertTriangle}
            label={t("dashboard.reorderAlerts")}
            value={String(data?.productosAReponer ?? 0)}
            tone="warning"
            onClick={() => setDetalle("reponer")}
          />
          <StatCard
            icon={Clock}
            label={t("dashboard.expiringSoon")}
            value={String(data?.lotesPorVencer ?? 0)}
            tone="critical"
            onClick={() => setDetalle("vencer")}
          />
          <StatCard
            icon={Boxes}
            label={t("dashboard.activeProducts")}
            value={String(data?.totalProductosActivos ?? 0)}
            onClick={() => setDetalle("activos")}
          />
        </div>
      )}

      {detalle && <DetalleModal tipo={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

const formatoCantidad = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n);

function EstadoStock({ fila }: { fila: DetalleProductoPanel }) {
  if (fila.stockActual <= 0) {
    return <span className="rounded-full bg-stock-critical/15 px-2 py-0.5 text-xs font-medium text-stock-critical">Sin stock</span>;
  }
  if (fila.aReponer) {
    return <span className="rounded-full bg-stock-low/15 px-2 py-0.5 text-xs font-medium text-stock-low">A reponer</span>;
  }
  return <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">OK</span>;
}

const columnasProducto = (conEstado: boolean): ResponsiveTableColumn<DetalleProductoPanel>[] => [
  {
    key: "nombre",
    header: "Material",
    cell: (f) => (
      <div>
        <p className="font-medium text-on-surface">{f.nombre}</p>
        <p className="font-data text-xs text-on-surface-variant">{f.sku}</p>
      </div>
    ),
  },
  { key: "categoria", header: "Categoría", cell: (f) => f.categoria ?? "—", hideOnCard: true },
  {
    key: "stock",
    header: "Stock actual",
    cell: (f) => (
      <span className="font-data font-medium">
        {formatoCantidad(f.stockActual)} {f.unidad}
      </span>
    ),
  },
  { key: "reposicion", header: "Punto de reposición", cell: (f) => <span className="font-data">{formatoCantidad(f.puntoReposicion)}</span> },
  ...(conEstado
    ? [{ key: "estado", header: "Estado", cell: (f: DetalleProductoPanel) => <EstadoStock fila={f} /> }]
    : [
        { key: "minimo", header: "Stock mínimo", cell: (f: DetalleProductoPanel) => <span className="font-data">{formatoCantidad(f.stockMinimo)}</span>, hideOnCard: true },
        { key: "proveedor", header: "Proveedor", cell: (f: DetalleProductoPanel) => f.proveedor ?? "—" },
      ]),
];

const columnasVencer: ResponsiveTableColumn<DetalleLotePorVencer>[] = [
  {
    key: "nombre",
    header: "Material",
    cell: (l) => (
      <div>
        <p className="font-medium text-on-surface">{l.nombre}</p>
        <p className="font-data text-xs text-on-surface-variant">{l.sku}</p>
      </div>
    ),
  },
  { key: "lote", header: "Lote", cell: (l) => <span className="font-data">{l.numeroLote ?? "—"}</span> },
  {
    key: "vence",
    header: "Vence",
    cell: (l) => (
      <span className="font-data">{new Date(l.fechaVencimiento).toLocaleDateString(undefined, { timeZone: "UTC" })}</span>
    ),
  },
  {
    key: "dias",
    header: "Días",
    cell: (l) =>
      l.diasRestantes < 0 ? (
        <span className="font-medium text-stock-critical">Vencido hace {-l.diasRestantes} d</span>
      ) : l.diasRestantes === 0 ? (
        <span className="font-medium text-stock-critical">Vence hoy</span>
      ) : (
        <span className="font-medium text-stock-low">{l.diasRestantes} d</span>
      ),
  },
  { key: "cantidad", header: "Cantidad del lote", cell: (l) => <span className="font-data font-medium">{formatoCantidad(l.cantidad)}</span> },
  { key: "stock", header: "Stock total", cell: (l) => <span className="font-data">{formatoCantidad(l.stockActual)}</span>, hideOnCard: true },
];

const titulos: Record<TipoDetalle, { titulo: string; vacio: string }> = {
  reponer: { titulo: "Productos a reponer", vacio: "No hay productos para reponer." },
  vencer: { titulo: "Lotes por vencer", vacio: "No hay lotes próximos a vencer." },
  activos: { titulo: "Productos activos", vacio: "No hay productos activos." },
};

function DetalleModal({ tipo, onClose }: { tipo: TipoDetalle; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-detalle", tipo],
    queryFn: async () => (await apiClient.get<unknown[]>(`/dashboard/detalle/${tipo}`)).data,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { titulo, vacio } = titulos[tipo];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-surface-container-lowest shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/30 p-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-on-surface-variant">Panel</p>
            <h2 className="mt-1 text-2xl font-semibold text-on-surface">{titulo}</h2>
            {data && <p className="mt-1 text-sm text-on-surface-variant">{data.length} en total</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          {tipo === "vencer" ? (
            <ResponsiveTable
              columns={columnasVencer}
              data={data as DetalleLotePorVencer[] | undefined}
              rowKey={(l) => l.loteId}
              isLoading={isLoading}
              loadingLabel={t("common.loading")}
              emptyLabel={vacio}
            />
          ) : (
            <ResponsiveTable
              columns={columnasProducto(tipo === "activos")}
              data={data as DetalleProductoPanel[] | undefined}
              rowKey={(f) => f.productoId}
              isLoading={isLoading}
              loadingLabel={t("common.loading")}
              emptyLabel={vacio}
            />
          )}
        </div>
      </div>
    </div>
  );
}
