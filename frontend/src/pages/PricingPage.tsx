import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, History, Search, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import type { ListaPrecio, PrecioListado, PrecioProducto } from "@/lib/types";

export function PricingPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const puedeVerCosto = useAuthStore((s) => s.tienePermiso("productos.ver_costo"));
  const puedeEditarPrecio = useAuthStore((s) => s.tienePermiso("precios.editar"));
  const { data: listas } = useQuery({
    queryKey: ["listas-precio"],
    queryFn: async () => (await apiClient.get<ListaPrecio[]>("/catalogos/listas-precio")).data,
  });
  const [listaId, setListaId] = useState<string>("");
  const [editando, setEditando] = useState<PrecioListado | null>(null);
  const [historialDe, setHistorialDe] = useState<PrecioListado | null>(null);
  const [search, setSearch] = useState("");

  const listaActiva = listaId || listas?.[0]?.id || "";

  const { data: precios, isLoading } = useQuery({
    queryKey: ["precios", listaActiva],
    queryFn: async () => (await apiClient.get<PrecioListado[]>("/precios", { params: { listaPrecioId: listaActiva } })).data,
    enabled: !!listaActiva,
  });

  const preciosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return precios;
    return precios?.filter((p) => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [precios, search]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-on-surface">{t("pricing.title")}</h1>
      <p className="mb-6 text-sm text-on-surface-variant">{t("pricing.subtitle")}</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {listas?.map((lista) => (
          <button
            key={lista.id}
            onClick={() => setListaId(lista.id)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              listaActiva === lista.id
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant text-on-surface-variant"
            }`}
          >
            {lista.nombre}
          </button>
        ))}
      </div>

      {editando && (
        <EditPriceForm
          producto={editando}
          listaPrecioId={listaActiva}
          onDone={() => {
            setEditando(null);
            queryClient.invalidateQueries({ queryKey: ["precios", listaActiva] });
          }}
        />
      )}
      {historialDe && (
        <HistoryPanel producto={historialDe} listaPrecioId={listaActiva} onClose={() => setHistorialDe(null)} />
      )}

      <div className="mb-4 flex items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2">
        <Search size={16} className="text-on-surface-variant" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número o descripción..."
          className="w-full text-sm outline-none"
        />
      </div>

      <ResponsiveTable
        columns={[
          {
            key: "producto",
            header: t("pricing.product"),
            cell: (p) => (
              <div>
                <p className="font-medium">{p.nombre}</p>
                <p className="font-data text-xs text-on-surface-variant">{p.sku}</p>
              </div>
            ),
          },
          ...(puedeVerCosto
            ? [
                {
                  key: "costo",
                  header: t("pricing.cost"),
                  cell: (p: PrecioListado) => <span className="font-data">${Number(p.costoPromedio).toFixed(2)}</span>,
                  hideOnCard: true,
                },
              ]
            : []),
          {
            key: "precio",
            header: t("pricing.currentPrice"),
            cell: (p) => (
              <span className="font-data font-semibold">
                {p.precioVigente ? `$${Number(p.precioVigente.precio).toFixed(2)}` : t("pricing.noPrice")}
              </span>
            ),
          },
          {
            key: "margen",
            header: t("pricing.margin"),
            cell: (p) => {
              const costo = Number(p.costoPromedio);
              const precio = Number(p.precioVigente?.precio);
              // Con el costo visible se calcula con el costo actual (el guardado puede quedar viejo).
              const margen =
                p.costoPromedio !== undefined && costo > 0 && precio > 0
                  ? margenSobreCosto(precio, costo)
                  : p.precioVigente?.margenPorcentaje
                    ? Number(p.precioVigente.margenPorcentaje)
                    : null;
              return (
                <span className={`font-data ${margen !== null && margen < 0 ? "text-error" : ""}`}>
                  {margen !== null ? `${margen.toFixed(1)}%` : "—"}
                </span>
              );
            },
            hideOnCard: true,
          },
          {
            key: "vigente",
            header: t("pricing.effectiveSince"),
            cell: (p) => (
              <span className="text-on-surface-variant">
                {p.precioVigente ? new Date(p.precioVigente.vigenteDesde).toLocaleDateString() : "—"}
              </span>
            ),
            hideOnCard: true,
          },
          {
            key: "acciones",
            header: t("users.actions"),
            cell: (p) => (
              <div className="flex items-center gap-3">
                {puedeEditarPrecio && (
                  <button
                    onClick={() => setEditando(p)}
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    <Pencil size={14} />
                    {t("pricing.editPrice")}
                  </button>
                )}
                <button
                  onClick={() => setHistorialDe(p)}
                  className="flex items-center gap-1 text-sm font-medium text-on-surface-variant hover:underline"
                >
                  <History size={14} />
                  {t("pricing.history")}
                </button>
              </div>
            ),
          },
        ]}
        data={preciosFiltrados}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        loadingLabel={t("common.loading")}
        emptyLabel={t("pricing.empty")}
      />
    </div>
  );
}

/** Margen sobre el costo: precio = costo × (1 + margen%). */
const margenSobreCosto = (precio: number, costo: number) => ((precio - costo) / costo) * 100;
const precioDesdeMargen = (margen: number, costo: number) => costo * (1 + margen / 100);
const redondear = (n: number) => String(Math.round(n * 100) / 100);

function EditPriceForm({
  producto,
  listaPrecioId,
  onDone,
}: {
  producto: PrecioListado;
  listaPrecioId: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const costo = Number(producto.costoPromedio);
  const calcula = producto.costoPromedio !== undefined && costo > 0;
  const [precio, setPrecio] = useState(producto.precioVigente?.precio ?? "");
  const [margen, setMargen] = useState(() => {
    const p = Number(producto.precioVigente?.precio);
    if (calcula && p > 0) return redondear(margenSobreCosto(p, costo));
    return producto.precioVigente?.margenPorcentaje ?? "";
  });
  const [error, setError] = useState<string | null>(null);
  const ganancia = calcula && Number(precio) > 0 ? Number(precio) - costo : null;

  function cambiarPrecio(valor: string) {
    setPrecio(valor);
    if (calcula) setMargen(valor === "" ? "" : redondear(margenSobreCosto(Number(valor), costo)));
  }

  function cambiarMargen(valor: string) {
    setMargen(valor);
    if (calcula && valor !== "") setPrecio(redondear(precioDesdeMargen(Number(valor), costo)));
  }

  const guardar = useMutation({
    mutationFn: async () =>
      (
        await apiClient.put("/precios", {
          productoId: producto.id,
          listaPrecioId,
          precio: Number(precio),
          margenPorcentaje: margen ? Number(margen) : null,
        })
      ).data,
    onSuccess: onDone,
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("pricing.priceError")),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-white/10 bg-surface-container-lowest shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-outline-variant/30 bg-gradient-to-r from-primary/10 via-surface-container-lowest to-transparent p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/40 bg-primary/10 text-primary">
              <Pencil size={20} />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-on-surface-variant">{t("pricing.editPrice")}</p>
              <h2 className="mt-1 text-xl font-semibold text-on-surface">{producto.nombre}</h2>
              {producto.costoPromedio !== undefined && (
                <p className="mt-1 font-data text-xs text-on-surface-variant">
                  {t("pricing.cost")}: ${Number(producto.costoPromedio).toFixed(2)}
                </p>
              )}
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
          className="overflow-y-auto p-6"
          onSubmit={(e) => {
            e.preventDefault();
            guardar.mutate();
          }}
        >
          {producto.precioVigente && (
            <div className="mb-4 rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">{t("pricing.currentPrice")}</p>
              <p className="mt-1 text-lg font-semibold text-on-surface">${Number(producto.precioVigente.precio).toFixed(2)}</p>
            </div>
          )}

          <label className="mb-1 block text-sm font-medium">{t("pricing.newPrice")}</label>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={precio}
            onChange={(e) => cambiarPrecio(e.target.value)}
            className="mb-4 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />

          <label className="mb-1 block text-sm font-medium">
            {t("pricing.margin")} sobre costo (%){" "}
            {!calcula && <span className="text-on-surface-variant">({t("batches.optional")})</span>}
          </label>
          <input
            type="number"
            step="0.01"
            value={margen}
            onChange={(e) => cambiarMargen(e.target.value)}
            className="mb-1 w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <p className="mb-4 text-xs text-on-surface-variant">
            {calcula
              ? "Cargá el precio o el margen: el otro se calcula solo con el costo."
              : producto.costoPromedio !== undefined
                ? "El producto todavía no tiene costo cargado: el margen no se puede calcular."
                : ""}
          </p>

          {ganancia !== null && (
            <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container p-3 text-center">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">{t("pricing.cost")}</p>
                <p className="font-data font-medium">${costo.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">Ganancia</p>
                <p className={`font-data font-medium ${ganancia < 0 ? "text-error" : "text-on-surface"}`}>${ganancia.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">Sobre venta</p>
                <p className="font-data font-medium">{((ganancia / Number(precio)) * 100).toFixed(1)}%</p>
              </div>
            </div>
          )}

          {error && <p className="mb-4 text-sm text-error">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={guardar.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
            >
              <Pencil size={16} />
              {t("pricing.confirmPrice")}
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

function HistoryPanel({
  producto,
  listaPrecioId,
  onClose,
}: {
  producto: PrecioListado;
  listaPrecioId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: historial, isLoading } = useQuery({
    queryKey: ["historial-precios", producto.id, listaPrecioId],
    queryFn: async () =>
      (
        await apiClient.get<PrecioProducto[]>("/precios/historial", {
          params: { productoId: producto.id, listaPrecioId },
        })
      ).data,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-surface-container-lowest shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 bg-gradient-to-r from-primary/10 via-surface-container-lowest to-transparent p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/40 bg-primary/10 text-primary">
              <History size={20} />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-on-surface-variant">{t("pricing.historyTitle")}</p>
              <h2 className="mt-1 text-lg font-semibold text-on-surface">{producto.nombre}</h2>
            </div>
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
          {!isLoading && (!historial || historial.length === 0) && (
            <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container p-6 text-center text-sm text-on-surface-variant">
              No hay historial de precios para este producto.
            </div>
          )}
          <ul className="space-y-2">
            {historial?.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between rounded-2xl border border-outline-variant/40 bg-surface-container p-4 text-sm"
              >
                <span className="font-data font-medium text-on-surface">${Number(h.precio).toFixed(2)}</span>
                <span className="text-xs text-on-surface-variant">
                  {new Date(h.vigenteDesde).toLocaleDateString()}
                  {h.vigenteHasta ? ` → ${new Date(h.vigenteHasta).toLocaleDateString()}` : ` → ${t("pricing.currentPrice")}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
