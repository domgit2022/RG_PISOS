import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, SlidersHorizontal, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Almacen, Lote, Proveedor } from "@/lib/types";

/** Datos mínimos del material que necesitan la vista y la carga de stock. */
export interface ProductoStock {
  id: string;
  controlaLote: boolean;
  controlaVencimiento: boolean;
  unidadMedida?: { codigo: string } | null;
}

interface LoteConocido {
  numeroLote: string;
  fechaVencimiento: string | null;
}

const estadoClases: Record<Lote["estado"], string> = {
  OK: "bg-secondary-container text-on-secondary-container",
  POR_VENCER: "bg-amber-100 text-stock-low",
  VENCIDO: "bg-expired-soft text-expired-text",
};

const formatoCantidad = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n);
const formatoFecha = (iso: string) => new Date(iso).toLocaleDateString(undefined, { timeZone: "UTC" });
const inputClases =
  "w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-70";

function useLotesProducto(productoId: string) {
  return useQuery({
    queryKey: ["lotes-producto", productoId],
    queryFn: async () => (await apiClient.get<Lote[]>("/stock/lotes", { params: { productoId } })).data,
  });
}

/**
 * Stock de un material en dos niveles, como en un ERP: arriba el total
 * disponible y la apertura por almacén; abajo el detalle por lote y almacén
 * (con vencimiento y estado). Opcionalmente incluye el formulario de carga.
 */
export function StockProducto({
  producto,
  conCarga = true,
  onAjustar,
}: {
  producto: ProductoStock;
  conCarga?: boolean;
  /** Si se pasa, cada fila tiene un botón para ajustar / registrar merma. */
  onAjustar?: (lote: Lote) => void;
}) {
  const { t } = useTranslation();
  const { data: lotes, isLoading } = useLotesProducto(producto.id);
  const [mostrandoCarga, setMostrandoCarga] = useState(false);
  const unidad = producto.unidadMedida?.codigo ?? "";

  const total = lotes?.reduce((acc, l) => acc + Number(l.cantidadActual), 0) ?? 0;
  const porAlmacen = useMemo(() => {
    const mapa = new Map<string, { nombre: string; cantidad: number }>();
    for (const l of lotes ?? []) {
      const actual = mapa.get(l.almacen.id) ?? { nombre: l.almacen.nombre, cantidad: 0 };
      actual.cantidad += Number(l.cantidadActual);
      mapa.set(l.almacen.id, actual);
    }
    return [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad);
  }, [lotes]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="min-w-[10rem] rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">Disponible total</p>
          <p className="mt-1 font-data text-2xl font-semibold text-on-surface">
            {formatoCantidad(total)} <span className="text-sm font-normal text-on-surface-variant">{unidad}</span>
          </p>
        </div>
        {porAlmacen.map((a) => (
          <div key={a.nombre} className="min-w-[8rem] rounded-2xl border border-outline-variant/40 bg-surface-container px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">{a.nombre}</p>
            <p className="mt-1 font-data text-lg font-semibold text-on-surface">{formatoCantidad(a.cantidad)}</p>
          </div>
        ))}
        {conCarga && !mostrandoCarga && (
          <button
            type="button"
            onClick={() => setMostrandoCarga(true)}
            className="ml-auto flex items-center gap-2 self-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
          >
            <Plus size={16} />
            Cargar stock
          </button>
        )}
      </div>

      {conCarga && mostrandoCarga && (
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
          <CargaStockForm producto={producto} onCancel={() => setMostrandoCarga(false)} />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">{t("common.loading")}</p>
      ) : !lotes?.length ? (
        <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container p-6 text-center text-sm text-on-surface-variant">
          Este material todavía no tiene stock.
        </div>
      ) : (
        <TablaStock producto={producto} lotes={lotes} onAjustar={onAjustar} />
      )}
    </div>
  );
}

const ordenEstado: Record<Lote["estado"], number> = { VENCIDO: 0, POR_VENCER: 1, OK: 2 };

interface GrupoStock {
  clave: string;
  numeroLote: string | null;
  fechaVencimiento: string | null;
  total: number;
  estado: Lote["estado"];
  registros: Lote[];
}

/**
 * Detalle del stock: si el material controla lote (o vencimiento), primero
 * un renglón por lote (o fecha) con el total de todos los almacenes, y al
 * abrirlo, la apertura por almacén. Sin esos controles, directo por almacén.
 */
function TablaStock({
  producto,
  lotes,
  onAjustar,
}: {
  producto: ProductoStock;
  lotes: Lote[];
  onAjustar?: (lote: Lote) => void;
}) {
  const { t } = useTranslation();
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const agrupa = producto.controlaLote || producto.controlaVencimiento;

  const grupos = useMemo<GrupoStock[]>(() => {
    const mapa = new Map<string, GrupoStock>();
    for (const l of lotes) {
      const fecha = l.fechaVencimiento?.slice(0, 10) ?? null;
      const clave = agrupa ? (producto.controlaLote ? `L:${l.numeroLote ?? ""}` : `F:${fecha ?? ""}`) : `A:${l.almacenId}`;
      const g = mapa.get(clave) ?? {
        clave,
        numeroLote: l.numeroLote,
        fechaVencimiento: l.fechaVencimiento,
        total: 0,
        estado: l.estado,
        registros: [],
      };
      g.total += Number(l.cantidadActual);
      if (ordenEstado[l.estado] < ordenEstado[g.estado]) g.estado = l.estado;
      g.registros.push(l);
      mapa.set(clave, g);
    }
    return [...mapa.values()];
  }, [lotes, agrupa, producto.controlaLote]);

  const alternar = (clave: string) =>
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });

  const botonAjustar = (l: Lote) =>
    onAjustar && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAjustar(l);
        }}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <SlidersHorizontal size={14} />
        {t("batches.adjust")}
      </button>
    );

  const estadoBadge = (estado: Lote["estado"]) => (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${estadoClases[estado]}`}>
      {t(`batches.${estado === "OK" ? "ok" : estado === "POR_VENCER" ? "expiringSoon" : "expired"}`)}
    </span>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/40">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
            <tr>
              {producto.controlaLote && <th className="px-4 py-3">Lote</th>}
              {producto.controlaVencimiento && <th className="px-4 py-3">Vence</th>}
              <th className="px-4 py-3">Almacén</th>
              <th className="px-4 py-3 text-right">Cantidad</th>
              {producto.controlaVencimiento && <th className="px-4 py-3">Estado</th>}
              {onAjustar && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => {
              const varios = g.registros.length > 1;
              const abierto = abiertos.has(g.clave);
              const unico = g.registros[0];
              return (
                <Fragment key={g.clave}>
                  <tr
                    className={`border-t border-outline-variant/30 ${varios ? "cursor-pointer hover:bg-surface-container" : ""}`}
                    onClick={varios ? () => alternar(g.clave) : undefined}
                  >
                    {producto.controlaLote && (
                      <td className="px-4 py-3 font-data font-medium text-on-surface">
                        <span className="inline-flex items-center gap-1">
                          {varios ? (abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-[14px]" />}
                          {g.numeroLote ?? "—"}
                        </span>
                      </td>
                    )}
                    {producto.controlaVencimiento && (
                      <td className="px-4 py-3 font-data text-on-surface">
                        <span className="inline-flex items-center gap-1">
                          {!producto.controlaLote &&
                            (varios ? (abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-[14px]" />)}
                          {g.fechaVencimiento ? formatoFecha(g.fechaVencimiento) : "—"}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-on-surface">
                      {varios ? (
                        <span className="text-on-surface-variant">{g.registros.length} almacenes</span>
                      ) : (
                        unico.almacen.nombre
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-data font-semibold text-on-surface">{formatoCantidad(g.total)}</td>
                    {producto.controlaVencimiento && <td className="px-4 py-3">{estadoBadge(g.estado)}</td>}
                    {onAjustar && <td className="px-4 py-3 text-right">{!varios && botonAjustar(unico)}</td>}
                  </tr>
                  {varios &&
                    abierto &&
                    g.registros.map((l) => (
                      <tr key={l.id} className="border-t border-outline-variant/20 bg-surface-container/60">
                        {producto.controlaLote && <td className="px-4 py-2" />}
                        {producto.controlaVencimiento && <td className="px-4 py-2" />}
                        <td className="px-4 py-2 pl-8 text-on-surface">{l.almacen.nombre}</td>
                        <td className="px-4 py-2 text-right font-data text-on-surface">{formatoCantidad(Number(l.cantidadActual))}</td>
                        {producto.controlaVencimiento && <td className="px-4 py-2" />}
                        {onAjustar && <td className="px-4 py-2 text-right">{botonAjustar(l)}</td>}
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Carga de stock de un material. Pide sólo lo que el material controla:
 * lote (si controla lote) y vencimiento (si controla vencimiento). Si el
 * lote ya existe, completa su vencimiento y avisa que se acumula.
 */
export function CargaStockForm({
  producto,
  onDone,
  onCancel,
  conProveedor = false,
}: {
  producto: ProductoStock;
  onDone?: () => void;
  onCancel?: () => void;
  conProveedor?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: almacenes } = useQuery({
    queryKey: ["almacenes"],
    queryFn: async () => (await apiClient.get<Almacen[]>("/catalogos/almacenes")).data,
  });
  const { data: proveedores } = useQuery({
    queryKey: ["proveedores"],
    enabled: conProveedor,
    queryFn: async () => (await apiClient.get<Proveedor[]>("/proveedores")).data,
  });
  const { data: lotesConocidos } = useQuery({
    queryKey: ["lotes-conocidos", producto.id],
    enabled: producto.controlaLote,
    queryFn: async () =>
      (await apiClient.get<LoteConocido[]>("/stock/lotes-conocidos", { params: { productoId: producto.id } })).data,
  });
  const { data: lotes } = useLotesProducto(producto.id);

  const vacio = { almacenId: "", cantidad: "", costoUnitario: "", numeroLote: "", fechaVencimiento: "", proveedorId: "" };
  const [form, setForm] = useState(vacio);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // El almacén siempre se elige a mano (es obligatorio).
  const almacenId = form.almacenId;
  const loteExistente = producto.controlaLote
    ? lotesConocidos?.find((l) => l.numeroLote.toLowerCase() === form.numeroLote.trim().toLowerCase())
    : undefined;
  const fechaBloqueada = !!loteExistente?.fechaVencimiento;
  const fechaVencimiento = fechaBloqueada ? loteExistente!.fechaVencimiento! : form.fechaVencimiento;
  const acumulaEn = lotes?.find(
    (l) =>
      l.almacenId === almacenId &&
      (producto.controlaLote
        ? l.numeroLote?.toLowerCase() === form.numeroLote.trim().toLowerCase()
        : !producto.controlaVencimiento || (!!fechaVencimiento && l.fechaVencimiento?.slice(0, 10) === fechaVencimiento))
  );

  const cargar = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post("/stock/ingreso", {
          productoId: producto.id,
          almacenId,
          cantidad: Number(form.cantidad),
          costoUnitario: Number(form.costoUnitario) || 0,
          numeroLote: producto.controlaLote ? loteExistente?.numeroLote ?? form.numeroLote.trim() : null,
          fechaVencimiento: producto.controlaVencimiento ? fechaVencimiento || null : null,
          proveedorId: form.proveedorId || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes-producto", producto.id] });
      queryClient.invalidateQueries({ queryKey: ["lotes-conocidos", producto.id] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      queryClient.invalidateQueries({ queryKey: ["stock-resumen"] });
      setMensaje(`Se cargaron ${formatoCantidad(Number(form.cantidad))}${acumulaEn ? " (sumado al stock existente)" : ""}.`);
      setForm((f) => ({ ...vacio, almacenId: f.almacenId, costoUnitario: f.costoUnitario }));
      setError(null);
      onDone?.();
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("batches.incomingError")),
  });

  // No es un <form>: se usa también dentro del formulario de edición del material.
  function handleSubmit() {
    setMensaje(null);
    if (!almacenId) return setError(t("inventory.form.warehouseRequired"));
    if (!(Number(form.cantidad) > 0)) return setError("Ingresá una cantidad mayor a cero.");
    if (producto.controlaLote && !form.numeroLote.trim()) return setError(t("inventory.form.batchRequired"));
    if (producto.controlaVencimiento && !fechaVencimiento) return setError(t("inventory.form.expiryRequired"));
    cargar.mutate();
  }

  return (
    <div
      onKeyDown={(e) => {
        // Enter carga el stock (y no envía el formulario del material que lo contiene).
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault();
          handleSubmit();
        }
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {producto.controlaLote && (
          <div>
            <label className="mb-1 block text-xs font-medium text-on-surface-variant">{t("batches.batchNumber")} *</label>
            <input
              list={`lotes-${producto.id}`}
              value={form.numeroLote}
              onChange={(e) => setForm((f) => ({ ...f, numeroLote: e.target.value }))}
              placeholder="Nuevo o existente"
              className={inputClases}
            />
            <datalist id={`lotes-${producto.id}`}>
              {lotesConocidos?.map((l) => (
                <option key={l.numeroLote} value={l.numeroLote}>
                  {l.fechaVencimiento ? `Vence ${formatoFecha(l.fechaVencimiento)}` : ""}
                </option>
              ))}
            </datalist>
          </div>
        )}
        {producto.controlaVencimiento && (
          <div>
            <label className="mb-1 block text-xs font-medium text-on-surface-variant">{t("batches.expiryDate")} *</label>
            <input
              type="date"
              value={fechaVencimiento}
              disabled={fechaBloqueada}
              onChange={(e) => setForm((f) => ({ ...f, fechaVencimiento: e.target.value }))}
              className={inputClases}
            />
            {fechaBloqueada && <p className="mt-1 text-xs text-on-surface-variant">Vencimiento del lote existente.</p>}
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-on-surface-variant">{t("batches.warehouse")} *</label>
          <select
            value={almacenId}
            onChange={(e) => setForm((f) => ({ ...f, almacenId: e.target.value }))}
            className={inputClases}
          >
            <option value="">{t("batches.warehouse")}</option>
            {almacenes?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-on-surface-variant">{t("batches.quantity")} *</label>
          <input
            type="number"
            min={0}
            step="0.001"
            value={form.cantidad}
            onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
            className={inputClases}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-on-surface-variant">{t("batches.unitCost")}</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.costoUnitario}
            onChange={(e) => setForm((f) => ({ ...f, costoUnitario: e.target.value }))}
            className={inputClases}
          />
        </div>
        {conProveedor && (
          <div>
            <label className="mb-1 block text-xs font-medium text-on-surface-variant">
              {t("batches.supplier")} ({t("batches.optional")})
            </label>
            <select
              value={form.proveedorId}
              onChange={(e) => setForm((f) => ({ ...f, proveedorId: e.target.value }))}
              className={inputClases}
            >
              <option value="">{t("inventory.form.none")}</option>
              {proveedores?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {acumulaEn && Number(form.cantidad) > 0 && (
        <p className="mt-3 text-xs text-on-surface-variant">
          Se suma a lo que ya hay
          {producto.controlaLote ? ` del lote ${acumulaEn.numeroLote}` : ""} en {acumulaEn.almacen.nombre} (
          {formatoCantidad(Number(acumulaEn.cantidadActual))} → {formatoCantidad(Number(acumulaEn.cantidadActual) + Number(form.cantidad))}).
        </p>
      )}
      {error && <p className="mt-3 text-sm text-error">{error}</p>}
      {mensaje && !error && <p className="mt-3 text-sm text-primary">{mensaje}</p>}

      <div className="mt-3 flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 rounded-md border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant"
          >
            <X size={16} />
            {t("common.cancel")}
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={cargar.isPending}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
        >
          <Plus size={16} />
          Cargar stock
        </button>
      </div>
    </div>
  );
}
