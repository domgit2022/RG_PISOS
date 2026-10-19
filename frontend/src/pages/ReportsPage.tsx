import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { EnviarInformeButton } from "@/components/EnviarInformeButton";

interface StockValorizado {
  valorTotalCosto: number;
  valorTotalVenta: number;
  porCategoria: { categoria: string; valorCosto: number; valorVenta: number }[];
}

interface ProductoAVencer {
  producto: string;
  sku: string;
  numeroLote: string | null;
  fechaVencimiento: string;
  diasRestantes: number;
  cantidad: number;
  valorEnRiesgo: number;
}

interface ProductoStockBajo {
  nombre: string;
  sku: string;
  categoria: string;
  stockActual: number;
  puntoReposicion: number;
}

interface ReporteVentas {
  totalVentas: number;
  totalFacturado: number;
  porProducto: { producto: string; cantidad: number; total: number }[];
  porVendedor: { vendedor: string; total: number }[];
}

interface ReporteMermas {
  valorTotalPerdido: number;
  movimientos: {
    id: string;
    tipo: string;
    cantidad: string;
    fecha: string;
    motivo: string | null;
    producto: { nombre: string; sku: string };
  }[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}

async function descargar(path: string, filename: string) {
  const res = await apiClient.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const { t } = useTranslation();

  const { data: stockValorizado } = useQuery({
    queryKey: ["reporte-stock-valorizado"],
    queryFn: async () => (await apiClient.get<StockValorizado>("/reportes/stock-valorizado")).data,
  });
  const { data: aVencer } = useQuery({
    queryKey: ["reporte-a-vencer"],
    queryFn: async () => (await apiClient.get<ProductoAVencer[]>("/reportes/productos-a-vencer")).data,
  });
  const { data: stockBajo } = useQuery({
    queryKey: ["reporte-stock-bajo"],
    queryFn: async () => (await apiClient.get<ProductoStockBajo[]>("/reportes/stock-bajo")).data,
  });

  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: ventas } = useQuery({
    queryKey: ["reporte-ventas", desde, hasta],
    queryFn: async () =>
      (await apiClient.get<ReporteVentas>("/reportes/ventas", { params: { desde, hasta } })).data,
  });
  const { data: mermas } = useQuery({
    queryKey: ["reporte-mermas", desde, hasta],
    queryFn: async () =>
      (await apiClient.get<ReporteMermas>("/reportes/mermas-ajustes", { params: { desde, hasta } })).data,
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-on-surface">{t("reports.title")}</h1>
          <p className="text-sm text-on-surface-variant">{t("reports.subtitle")}</p>
        </div>
        <EnviarInformeButton />
      </div>

      <section className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">{t("reports.stockValue")}</h2>
          <button
            onClick={() => descargar("/reportes/stock-valorizado/exportar", "stock-valorizado.xlsx")}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Download size={14} />
            {t("reports.exportExcel")}
          </button>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="rounded-md bg-surface-container p-4">
            <p className="text-xs uppercase text-on-surface-variant">{t("reports.totalCost")}</p>
            <p className="font-data text-xl font-semibold">{fmt(stockValorizado?.valorTotalCosto ?? 0)}</p>
          </div>
          <div className="rounded-md bg-surface-container p-4">
            <p className="text-xs uppercase text-on-surface-variant">{t("reports.totalSale")}</p>
            <p className="font-data text-xl font-semibold">{fmt(stockValorizado?.valorTotalVenta ?? 0)}</p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-on-surface-variant">
            <tr>
              <th className="py-1">{t("reports.byCategory")}</th>
              <th className="py-1">{t("reports.totalCost")}</th>
              <th className="py-1">{t("reports.totalSale")}</th>
            </tr>
          </thead>
          <tbody>
            {stockValorizado?.porCategoria.map((c) => (
              <tr key={c.categoria} className="border-t border-outline-variant/30">
                <td className="py-2">{c.categoria}</td>
                <td className="py-2 font-data">{fmt(c.valorCosto)}</td>
                <td className="py-2 font-data">{fmt(c.valorVenta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium">{t("reports.expiring")}</h2>
            <p className="text-xs text-on-surface-variant">{t("reports.expiringHint")}</p>
          </div>
          <button
            onClick={() => descargar("/reportes/productos-a-vencer/exportar", "productos-a-vencer.xlsx")}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Download size={14} />
            {t("reports.exportExcel")}
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-on-surface-variant">
            <tr>
              <th className="py-1">{t("batches.product")}</th>
              <th className="py-1">{t("batches.batchNumber")}</th>
              <th className="py-1">{t("batches.expiryDate")}</th>
              <th className="py-1">{t("reports.daysUntilExpiry")}</th>
              <th className="py-1">{t("batches.currentQty")}</th>
            </tr>
          </thead>
          <tbody>
            {aVencer?.map((p, i) => (
              <tr key={i} className="border-t border-outline-variant/30">
                <td className="py-2">
                  {p.producto} <span className="text-xs text-on-surface-variant">({p.sku})</span>
                </td>
                <td className="py-2 font-data">{p.numeroLote ?? "—"}</td>
                <td className="py-2 font-data">{new Date(p.fechaVencimiento).toLocaleDateString(undefined, { timeZone: "UTC" })}</td>
                <td className="py-2 font-data">
                  {p.diasRestantes < 0 ? (
                    <span className="text-expired-text">
                      {t("reports.expiredSince", { count: Math.abs(p.diasRestantes) })}
                    </span>
                  ) : (
                    t("reports.daysCount", { count: p.diasRestantes })
                  )}
                </td>
                <td className="py-2 font-data">{p.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6">
        <h2 className="mb-4 text-lg font-medium">{t("reports.lowStock")}</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-on-surface-variant">
            <tr>
              <th className="py-1">{t("inventory.name")}</th>
              <th className="py-1">{t("inventory.category")}</th>
              <th className="py-1">{t("inventory.stock")}</th>
              <th className="py-1">{t("inventory.reorderPoint")}</th>
            </tr>
          </thead>
          <tbody>
            {stockBajo?.map((p, i) => (
              <tr key={i} className="border-t border-outline-variant/30">
                <td className="py-2">
                  {p.nombre} <span className="font-data text-xs text-on-surface-variant">({p.sku})</span>
                </td>
                <td className="py-2 text-on-surface-variant">{p.categoria}</td>
                <td className="py-2 font-data">{p.stockActual}</td>
                <td className="py-2 font-data">{p.puntoReposicion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6">
        <h2 className="mb-4 text-lg font-medium">{t("reports.sales")}</h2>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("reports.from")}</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("reports.to")}</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="rounded-md bg-surface-container p-4">
            <p className="text-xs uppercase text-on-surface-variant">{t("reports.totalSales")}</p>
            <p className="font-data text-xl font-semibold">{ventas?.totalVentas ?? 0}</p>
          </div>
          <div className="rounded-md bg-surface-container p-4">
            <p className="text-xs uppercase text-on-surface-variant">{t("reports.totalBilled")}</p>
            <p className="font-data text-xl font-semibold">{fmt(ventas?.totalFacturado ?? 0)}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">{t("reports.byProduct")}</p>
            <table className="w-full text-sm">
              <tbody>
                {ventas?.porProducto.map((p, i) => (
                  <tr key={i} className="border-t border-outline-variant/30">
                    <td className="py-1">{p.producto}</td>
                    <td className="py-1 text-right font-data">{fmt(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t("reports.bySeller")}</p>
            <table className="w-full text-sm">
              <tbody>
                {ventas?.porVendedor.map((v, i) => (
                  <tr key={i} className="border-t border-outline-variant/30">
                    <td className="py-1">{v.vendedor}</td>
                    <td className="py-1 text-right font-data">{fmt(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6">
        <h2 className="mb-4 text-lg font-medium">{t("reports.lossesAdjustments")}</h2>
        <p className="mb-4 rounded-md bg-surface-container p-4 text-sm">
          {t("reports.totalLost")}: <span className="font-data font-semibold">{fmt(mermas?.valorTotalPerdido ?? 0)}</span>
        </p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-on-surface-variant">
            <tr>
              <th className="py-1">{t("batches.product")}</th>
              <th className="py-1">{t("batches.movementType")}</th>
              <th className="py-1">{t("batches.quantity")}</th>
              <th className="py-1">{t("batches.reason")}</th>
            </tr>
          </thead>
          <tbody>
            {mermas?.movimientos.map((m) => (
              <tr key={m.id} className="border-t border-outline-variant/30">
                <td className="py-2">{m.producto.nombre}</td>
                <td className="py-2">{m.tipo}</td>
                <td className="py-2 font-data">{m.cantidad}</td>
                <td className="py-2 text-on-surface-variant">{m.motivo ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
