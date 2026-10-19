import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Pencil, X, Download, Upload, FolderPlus, Camera, ImagePlus, Layers, Lock, ScanBarcode, Smartphone } from "lucide-react";
import { apiClient, resolveAssetUrl } from "@/lib/api-client";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { StockProducto } from "@/components/StockProducto";
import { FotoDesdeCelularModal } from "@/components/FotoDesdeCelularModal";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Categoria, Producto, ProductosResponse, Proveedor, UnidadMedida } from "@/lib/types";

const productPlaceholder = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23e5e7eb'/%3E%3Cpath d='M65 140h70l-10-25-18 18-16-24-26 31Z' fill='%239ca3af'/%3E%3Ccircle cx='78' cy='72' r='16' fill='%239ca3af'/%3E%3C/svg%3E";

const emptyForm = {
  sku: "",
  codigoBarras: "",
  nombre: "",
  descripcion: "",
  categoriaId: "",
  marca: "",
  unidadMedidaId: "",
  proveedorPrincipalId: "",
  imagenUrl: "",
  controlaVencimiento: false,
  diasAvisoVencimiento: "15",
  controlaLote: false,
  stockMinimo: "0",
  puntoReposicion: "0",
  stockMaximo: "",
  activo: true,
};

function ultimoNumeroDeSku(sku: string): number | null {
  const match = String(sku).match(/\d+/g);
  const numero = match ? Number(match[match.length - 1]) : NaN;
  return Number.isFinite(numero) ? numero : null;
}

export function InventoryPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showCategorias, setShowCategorias] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [productoSeleccionadoId, setProductoSeleccionadoId] = useState<string | null>(null);
  const [tabDetalle, setTabDetalle] = useState<"detalle" | "stock">("detalle");
  const [productoLotesId, setProductoLotesId] = useState<string | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickImageFile, setQuickImageFile] = useState<File | null>(null);
  const [quickImagePreview, setQuickImagePreview] = useState<string | null>(null);
  const [quickForm, setQuickForm] = useState({
    sku: "",
    codigoBarras: "",
    nombre: "",
    descripcion: "",
    categoriaId: "",
    marca: "",
    unidadMedidaId: "",
  });
  const [nuevaImagenFile, setNuevaImagenFile] = useState<File | null>(null);
  const [fotoCelularDestino, setFotoCelularDestino] = useState<"quick" | "form" | null>(null);
  const [nuevaImagenPreview, setNuevaImagenPreview] = useState<string | null>(null);
  const [scannerDestino, setScannerDestino] = useState<"form" | "quick" | "search" | null>(null);
  // Sin este debounce, tipear rápido (o un lector físico de código de barras,
  // que "tipea" el código completo en milisegundos) dispara un pedido al
  // backend por cada carácter; se amontonan contra la base remota y el
  // pedido del texto final puede tardar o perderse en el medio, dando la
  // sensación de que la búsqueda no encuentra el producto.
  const searchDebounced = useDebouncedValue(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ["productos", searchDebounced],
    queryFn: async () =>
      (
        await apiClient.get<ProductosResponse>("/productos", {
          params: { search: searchDebounced || undefined, pageSize: 50 },
        })
      ).data,
  });
  const { data: categorias } = useQuery({
    queryKey: ["categorias-planas"],
    queryFn: async () => (await apiClient.get<Categoria[]>("/categorias/planas")).data,
  });
  const { data: unidades } = useQuery({
    queryKey: ["unidades-medida"],
    queryFn: async () => (await apiClient.get<UnidadMedida[]>("/catalogos/unidades-medida")).data,
  });
  const { data: proveedores } = useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => (await apiClient.get<Proveedor[]>("/proveedores")).data,
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const productoEditando = data?.items.find((producto) => producto.id === editingId) ?? null;
  // Con stock no se cambian los controles de lote/vencimiento (lo valida también el backend).
  const controlesBloqueados = !!productoEditando && productoEditando.stockActual > 0;
  const productoSeleccionado = data?.items.find((producto) => producto.id === productoSeleccionadoId) ?? null;
  const productoLotes = data?.items.find((producto) => producto.id === productoLotesId) ?? null;
  const [error, setError] = useState<string | null>(null);
  const siguienteSkuSugerido = useMemo(() => {
    const maxNumero = (data?.items ?? []).reduce((max, producto) => {
      const numero = ultimoNumeroDeSku(producto.sku);
      return numero !== null ? Math.max(max, numero) : max;
    }, 0);
    return String(maxNumero + 1);
  }, [data?.items]);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("");
  const [mostrandoNuevaCategoria, setMostrandoNuevaCategoria] = useState(false);

  function extraerError(err: unknown, fallback: string) {
    return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
  }

  function toPayload() {
    return {
      sku: form.sku,
      codigoBarras: form.codigoBarras.trim() || null,
      nombre: form.nombre,
      descripcion: form.descripcion.trim() || null,
      categoriaId: form.categoriaId || null,
      marca: form.marca.trim() || null,
      unidadMedidaId: form.unidadMedidaId,
      proveedorPrincipalId: form.proveedorPrincipalId || null,
      imagenUrl: form.imagenUrl || null,
      controlaVencimiento: form.controlaVencimiento,
      diasAvisoVencimiento: Number(form.diasAvisoVencimiento) || 0,
      controlaLote: form.controlaLote,
      stockMinimo: Number(form.stockMinimo) || 0,
      puntoReposicion: Number(form.puntoReposicion) || 0,
      stockMaximo: form.stockMaximo ? Number(form.stockMaximo) : null,
    };
  }

  async function uploadProductoImagen(productoId: string, file: File) {
    const formData = new FormData();
    formData.append("imagen", file);
    await apiClient.post(`/productos/${productoId}/imagen`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }

  function resetQuickCreate() {
    setQuickForm({
      sku: siguienteSkuSugerido,
      codigoBarras: "",
      nombre: "",
      descripcion: "",
      categoriaId: "",
      marca: "",
      unidadMedidaId: unidades?.[0]?.id ?? "",
    });
    setQuickImageFile(null);
    setQuickImagePreview(null);
    setQuickError(null);
  }

  const crear = useMutation({
    mutationFn: async () => {
      const producto = await apiClient
        .post<Producto>("/productos", { ...toPayload(), activo: form.activo })
        .then((r) => r.data);
      // La imagen va aparte: si falla, el material ya quedó guardado.
      let errorImagen: string | null = null;
      if (nuevaImagenFile) {
        try {
          await uploadProductoImagen(producto.id, nuevaImagenFile);
        } catch (err) {
          errorImagen = extraerError(err, "error desconocido");
        }
      }
      return { producto, errorImagen };
    },
    onSuccess: ({ producto, errorImagen }) => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      if (errorImagen) {
        // Queda abierto en modo edición para reintentar la foto sin duplicar el material.
        handleEditar(producto);
        setError(`El material se guardó, pero no se pudo subir la imagen: ${errorImagen}`);
        return;
      }
      const numero = ultimoNumeroDeSku(producto.sku);
      setForm({ ...emptyForm, sku: numero !== null ? String(numero + 1) : "" });
      setNuevaImagenFile(null);
      setNuevaImagenPreview(null);
      setError(null);
    },
    onError: (err: unknown) => setError(extraerError(err, t("inventory.form.createError"))),
  });

  const crearCategoriaRapida = useMutation({
    mutationFn: async () => (await apiClient.post<Categoria>("/categorias", { nombre: nuevaCategoriaNombre })).data,
    onSuccess: (categoria) => {
      queryClient.invalidateQueries({ queryKey: ["categorias-planas"] });
      if (showQuickCreate) {
        setQuickForm((f) => ({ ...f, categoriaId: categoria.id }));
        setQuickError(null);
      } else {
        setForm((f) => ({ ...f, categoriaId: categoria.id }));
        setError(null);
      }
      setNuevaCategoriaNombre("");
      setMostrandoNuevaCategoria(false);
    },
    onError: (err: unknown) => {
      const mensaje = extraerError(err, t("inventory.form.createError"));
      if (showQuickCreate) setQuickError(mensaje);
      else setError(mensaje);
    },
  });

  const guardar = useMutation({
    mutationFn: async () => {
      const actualizado = (
        await apiClient.put<Producto>(`/productos/${editingId}`, { ...toPayload(), activo: form.activo })
      ).data;
      if (nuevaImagenFile) {
        await uploadProductoImagen(actualizado.id, nuevaImagenFile);
      }
      return actualizado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      queryClient.invalidateQueries({ queryKey: ["lotes-producto"] });
      handleCancelar();
    },
    onError: (err: unknown) => setError(extraerError(err, t("inventory.form.updateError"))),
  });

  function productoToForm(producto: Producto) {
    return {
      sku: producto.sku,
      codigoBarras: producto.codigoBarras ?? "",
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? "",
      categoriaId: producto.categoriaId ?? "",
      marca: producto.marca ?? "",
      unidadMedidaId: producto.unidadMedidaId,
      proveedorPrincipalId: producto.proveedorPrincipalId ?? "",
      imagenUrl: producto.imagenUrl ?? "",
      controlaVencimiento: producto.controlaVencimiento,
      diasAvisoVencimiento: String(producto.diasAvisoVencimiento),
      controlaLote: producto.controlaLote,
      stockMinimo: producto.stockMinimo,
      puntoReposicion: producto.puntoReposicion,
      stockMaximo: producto.stockMaximo ?? "",
      activo: producto.activo,
    };
  }

  function handleEditar(producto: Producto) {
    setEditingId(producto.id);
    setForm(productoToForm(producto));
    setNuevaImagenFile(null);
    setNuevaImagenPreview(producto.imagenUrl ? resolveAssetUrl(producto.imagenUrl) : null);
    setProductoSeleccionadoId(null);
    setProductoLotesId(null);
    setShowForm(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleNuevo() {
    setEditingId(null);
    setForm({ ...emptyForm, sku: siguienteSkuSugerido });
    setNuevaImagenFile(null);
    setNuevaImagenPreview(null);
    setError(null);
    setShowForm(true);
  }

  function handleCancelar() {
    setEditingId(null);
    setForm(emptyForm);
    setProductoSeleccionadoId(null);
    setError(null);
    setShowForm(false);
    setMostrandoNuevaCategoria(false);
    setNuevaImagenFile(null);
    setNuevaImagenPreview(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      guardar.mutate();
      return;
    }
    crear.mutate();
  }

  async function handleExportar() {
    const res = await apiClient.get("/importar-exportar/productos/exportar", { responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "productos.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  const guardando = crear.isPending || guardar.isPending;

  useEffect(() => {
    if (showQuickCreate) {
      resetQuickCreate();
    }
    setMostrandoNuevaCategoria(false);
    setNuevaCategoriaNombre("");
  }, [showQuickCreate]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">{t("inventory.title")}</h1>
          <p className="text-sm text-on-surface-variant">{t("inventory.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowCategorias((v) => !v)}
            className="flex items-center gap-2 rounded-md border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant"
          >
            <FolderPlus size={16} />
            {t("inventory.manageCategories")}
          </button>
          <button
            onClick={handleExportar}
            className="flex items-center gap-2 rounded-md border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant"
          >
            <Download size={16} />
            {t("inventory.export")}
          </button>
          <button
            onClick={() => setShowImport((v) => !v)}
            className="flex items-center gap-2 rounded-md border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant"
          >
            <Upload size={16} />
            {t("inventory.import")}
          </button>
          <button
            type="button"
            onClick={() => setShowQuickCreate(true)}
            className="flex items-center gap-2 rounded-md border border-primary/60 bg-primary/5 px-4 py-2 text-sm font-medium text-primary"
          >
            <Camera size={16} />
            Carga rápida
          </button>
          <button
            onClick={() => (showForm ? handleCancelar() : handleNuevo())}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
          >
            <Plus size={16} />
            {t("inventory.addProduct")}
          </button>
        </div>
      </div>

      {showCategorias && <CategoryManager />}
      {showQuickCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] border border-white/10 bg-surface-container-lowest p-6 shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-on-surface-variant">Carga rápida</p>
                <h2 className="mt-1 text-2xl font-semibold text-on-surface">Nuevo material</h2>
              </div>
              <button type="button" onClick={() => setShowQuickCreate(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Material</label>
                <input
                  value={quickForm.sku}
                  onChange={(e) => setQuickForm((f) => ({ ...f, sku: e.target.value }))}
                  className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Nombre</label>
                <input
                  value={quickForm.nombre}
                  onChange={(e) => setQuickForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">{t("inventory.form.barcode")}</label>
                <div className="flex items-center gap-2">
                  <input
                    value={quickForm.codigoBarras}
                    onChange={(e) => setQuickForm((f) => ({ ...f, codigoBarras: e.target.value }))}
                    className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setScannerDestino("quick")}
                    title={t("scanner.title")}
                    className="shrink-0 rounded-md border border-outline-variant p-2 text-on-surface-variant hover:bg-surface-container"
                  >
                    <ScanBarcode size={16} />
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Categoría</label>
                {!mostrandoNuevaCategoria ? (
                  <div className="flex gap-2">
                    <select
                      value={quickForm.categoriaId}
                      onChange={(e) => setQuickForm((f) => ({ ...f, categoriaId: e.target.value }))}
                      className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    >
                      <option value="">Sin categoría</option>
                      {categorias?.map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setMostrandoNuevaCategoria(true)}
                      title={t("inventory.addCategory")}
                      className="shrink-0 rounded-md border border-outline-variant px-3 text-on-surface-variant"
                    >
                      <FolderPlus size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={nuevaCategoriaNombre}
                      onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                      placeholder={t("inventory.categoryName")}
                      className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={!nuevaCategoriaNombre.trim() || crearCategoriaRapida.isPending}
                      onClick={() => crearCategoriaRapida.mutate()}
                      className="shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-on-primary disabled:opacity-60"
                    >
                      Agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMostrandoNuevaCategoria(false);
                        setNuevaCategoriaNombre("");
                      }}
                      className="shrink-0 rounded-md border border-outline-variant px-3 text-on-surface-variant"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Unidad</label>
                <select
                  value={quickForm.unidadMedidaId}
                  onChange={(e) => setQuickForm((f) => ({ ...f, unidadMedidaId: e.target.value }))}
                  className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">Seleccionar</option>
                  {unidades?.map((unidad) => (
                    <option key={unidad.id} value={unidad.id}>{unidad.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Marca</label>
                <input
                  value={quickForm.marca}
                  onChange={(e) => setQuickForm((f) => ({ ...f, marca: e.target.value }))}
                  className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Descripción</label>
                <textarea
                  rows={2}
                  value={quickForm.descripcion}
                  onChange={(e) => setQuickForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Foto del producto</label>
                <div className="flex items-center gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container p-3">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
                    <img
                      src={quickImagePreview ?? productPlaceholder}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-on-primary">
                      <ImagePlus size={16} />
                      Subir foto
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setQuickImageFile(file);
                          setQuickImagePreview(file ? URL.createObjectURL(file) : null);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setFotoCelularDestino("quick")}
                      className="inline-flex items-center gap-2 rounded-md border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant hover:border-primary/60 hover:text-primary"
                    >
                      <Smartphone size={16} />
                      Desde el celular
                    </button>
                    {quickImageFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickImageFile(null);
                          setQuickImagePreview(null);
                        }}
                        className="rounded-md border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {quickError && <p className="mt-4 text-sm text-error">{quickError}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowQuickCreate(false)} className="rounded-md border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant">Cancelar</button>
              <button
                type="button"
                onClick={async () => {
                  const sku = quickForm.sku.trim();
                  const nombre = quickForm.nombre.trim();
                  const unidadId = quickForm.unidadMedidaId || unidades?.[0]?.id;
                  if (!sku || !nombre || !unidadId) {
                    setQuickError("Ingresá material, nombre y unidad para continuar.");
                    return;
                  }
                  if (data?.items.some((producto) => producto.sku.trim().toLowerCase() === sku.toLowerCase())) {
                    setQuickError("Ya existe un material con ese código. Modificá el número o elegí otro.");
                    return;
                  }
                  const codigoBarras = quickForm.codigoBarras.trim();
                  if (codigoBarras && data?.items.some((producto) => producto.codigoBarras?.trim() === codigoBarras)) {
                    setQuickError("Ya existe un material con ese código de barras.");
                    return;
                  }

                  try {
                    const producto = (
                      await apiClient.post<Producto>("/productos", {
                        sku,
                        codigoBarras: codigoBarras || null,
                        nombre,
                        descripcion: quickForm.descripcion.trim() || null,
                        categoriaId: quickForm.categoriaId || null,
                        marca: quickForm.marca.trim() || null,
                        unidadMedidaId: unidadId,
                        controlaVencimiento: false,
                        controlaLote: false,
                        stockMinimo: 0,
                        puntoReposicion: 0,
                      })
                    ).data;

                    if (quickImageFile) {
                      await uploadProductoImagen(producto.id, quickImageFile);
                    }

                    queryClient.invalidateQueries({ queryKey: ["productos"] });
                    setShowQuickCreate(false);
                    setProductoSeleccionadoId(producto.id);
                    setTabDetalle("detalle");
                    resetQuickCreate();
                  } catch (err) {
                    setQuickError(extraerError(err, "No se pudo crear el material."));
                  }
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
              >
                Guardar material
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && <ImportPanel />}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 grid grid-cols-1 gap-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">{t("inventory.form.sku")}</label>
            <input
              required
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("inventory.form.barcode")}</label>
            <div className="flex items-center gap-2">
              <input
                value={form.codigoBarras}
                onChange={(e) => setForm((f) => ({ ...f, codigoBarras: e.target.value }))}
                className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setScannerDestino("form")}
                title={t("scanner.title")}
                className="shrink-0 rounded-md border border-outline-variant p-2 text-on-surface-variant hover:bg-surface-container"
              >
                <ScanBarcode size={16} />
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("inventory.form.name")}</label>
            <input
              required
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1 block text-sm font-medium">{t("inventory.form.description")}</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              rows={2}
              className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 rounded-md border border-outline-variant/40 bg-surface-container p-4">
            <p className="mb-2 text-sm font-medium">Foto del material</p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
                <img
                  src={nuevaImagenPreview ?? (form.imagenUrl ? resolveAssetUrl(form.imagenUrl) ?? productPlaceholder : productPlaceholder)}
                  alt="Foto del material"
                  className="h-full w-full object-cover"
                />
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-on-primary">
                <ImagePlus size={16} />
                {nuevaImagenFile ? "Cambiar foto" : "Subir foto"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setNuevaImagenFile(file);
                    setNuevaImagenPreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => setFotoCelularDestino("form")}
                className="inline-flex items-center gap-2 rounded-md border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant hover:border-primary/60 hover:text-primary"
              >
                <Smartphone size={16} />
                Desde el celular
              </button>
              {nuevaImagenFile && (
                <button
                  type="button"
                  onClick={() => {
                    setNuevaImagenFile(null);
                    setNuevaImagenPreview(form.imagenUrl ? resolveAssetUrl(form.imagenUrl) ?? null : null);
                  }}
                  className="rounded-md border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface-variant"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("inventory.form.category")}</label>
            {!mostrandoNuevaCategoria ? (
              <div className="flex gap-2">
                <select
                  value={form.categoriaId}
                  onChange={(e) => setForm((f) => ({ ...f, categoriaId: e.target.value }))}
                  className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">{t("inventory.form.none")}</option>
                  {categorias?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setMostrandoNuevaCategoria(true)}
                  title={t("inventory.addCategory")}
                  className="shrink-0 rounded-md border border-outline-variant px-3 text-on-surface-variant"
                >
                  <FolderPlus size={16} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={nuevaCategoriaNombre}
                  onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                  placeholder={t("inventory.categoryName")}
                  className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!nuevaCategoriaNombre.trim() || crearCategoriaRapida.isPending}
                  onClick={() => crearCategoriaRapida.mutate()}
                  className="shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-on-primary disabled:opacity-60"
                >
                  {t("inventory.addCategory")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrandoNuevaCategoria(false);
                    setNuevaCategoriaNombre("");
                  }}
                  className="shrink-0 rounded-md border border-outline-variant px-3 text-on-surface-variant"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("inventory.form.brand")}</label>
            <input
              value={form.marca}
              onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
              className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("inventory.form.unit")}</label>
            <select
              required
              value={form.unidadMedidaId}
              onChange={(e) => setForm((f) => ({ ...f, unidadMedidaId: e.target.value }))}
              className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="" disabled>
                {t("inventory.form.unit")}
              </option>
              {unidades?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("inventory.form.supplier")}</label>
            <select
              value={form.proveedorPrincipalId}
              onChange={(e) => setForm((f) => ({ ...f, proveedorPrincipalId: e.target.value }))}
              className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">{t("inventory.form.none")}</option>
              {proveedores?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("inventory.form.minStock")}</label>
            <input
              type="number"
              min={0}
              value={form.stockMinimo}
              onChange={(e) => setForm((f) => ({ ...f, stockMinimo: e.target.value }))}
              className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("inventory.form.reorderPoint")}</label>
            <input
              type="number"
              min={0}
              value={form.puntoReposicion}
              onChange={(e) => setForm((f) => ({ ...f, puntoReposicion: e.target.value }))}
              className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("inventory.form.maxStock")}</label>
            <input
              type="number"
              min={0}
              value={form.stockMaximo}
              onChange={(e) => setForm((f) => ({ ...f, stockMaximo: e.target.value }))}
              className="w-full rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.controlaVencimiento}
                disabled={controlesBloqueados}
                onChange={(e) => setForm((f) => ({ ...f, controlaVencimiento: e.target.checked }))}
                className="h-4 w-4 rounded border-outline-variant"
              />
              {t("inventory.form.tracksExpiry")}
            </label>
            {form.controlaVencimiento && (
              <label className="flex items-center gap-2 text-sm font-medium">
                {t("inventory.form.expiryWarningDays")}
                <input
                  type="number"
                  min={0}
                  value={form.diasAvisoVencimiento}
                  onChange={(e) => setForm((f) => ({ ...f, diasAvisoVencimiento: e.target.value }))}
                  className="w-20 rounded-md border border-outline-variant px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </label>
            )}
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.controlaLote}
                disabled={controlesBloqueados}
                onChange={(e) => setForm((f) => ({ ...f, controlaLote: e.target.checked }))}
                className="h-4 w-4 rounded border-outline-variant"
              />
              {t("inventory.form.tracksBatch")}
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                className="h-4 w-4 rounded border-outline-variant"
              />
              {t("inventory.form.activeLabel")}
            </label>
            <p className="w-full text-xs text-on-surface-variant">
              {controlesBloqueados
                ? "El material tiene stock: para cambiar el control de lote o vencimiento primero dejá el stock en cero."
                : "Con control por lote se pide el lote al cargar stock; con vencimiento, la fecha. Se pueden usar juntos o por separado."}
            </p>
          </div>

          {editingId && productoEditando && (
            <div className="rounded-md border border-outline-variant/40 bg-surface-container-lowest p-4 sm:col-span-2 lg:col-span-3">
              <p className="text-sm font-medium">Stock</p>
              <p className="mb-3 text-xs text-on-surface-variant">Para cargar o ajustar stock usá la pantalla Stock.</p>
              <StockProducto producto={productoEditando} conCarga={false} />
            </div>
          )}

          {error && <p className="text-sm text-error sm:col-span-2 lg:col-span-3">{error}</p>}

          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
            >
              {editingId ? <Pencil size={16} /> : <Plus size={16} />}
              {editingId ? t("common.save") : t("inventory.form.create")}
            </button>
            <button
              type="button"
              onClick={handleCancelar}
              className="flex items-center gap-2 rounded-md border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant"
            >
              <X size={16} />
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2">
        <Search size={16} className="text-on-surface-variant" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("inventory.search")}
          className="w-full text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => setScannerDestino("search")}
          title={t("scanner.title")}
          className="shrink-0 rounded-md p-1 text-on-surface-variant hover:bg-surface-container"
        >
          <ScanBarcode size={16} />
        </button>
      </div>

      <ResponsiveTable
        columns={[
          { key: "sku", header: t("inventory.sku"), cell: (p) => <span className="font-data">{p.sku}</span> },
          {
            key: "nombre",
            header: t("inventory.name"),
            cell: (p) => (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
                  <img
                    src={resolveAssetUrl(p.imagenUrl) ?? productPlaceholder}
                    alt={p.nombre}
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="font-medium">{p.nombre}</span>
              </div>
            ),
          },
          {
            key: "categoria",
            header: t("inventory.category"),
            cell: (p) => <span className="text-on-surface-variant">{p.categoria?.nombre ?? "—"}</span>,
            hideOnCard: true,
          },
          {
            key: "stock",
            header: t("inventory.stock"),
            cell: (p) => (
              <div className="flex items-center gap-2">
                <span className="font-data">{p.stockActual}</span>
                {(
                  <button
                    type="button"
                    title="Ver stock por almacén y lote"
                    onClick={(event) => {
                      event.stopPropagation();
                      setProductoLotesId(p.id);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-outline-variant text-on-surface-variant transition hover:border-primary/60 hover:text-primary"
                  >
                    <Layers size={13} />
                  </button>
                )}
              </div>
            ),
          },
          {
            key: "reorderPoint",
            header: t("inventory.reorderPoint"),
            cell: (p) => <span className="font-data">{p.puntoReposicion}</span>,
            hideOnCard: true,
          },
          {
            key: "status",
            header: t("inventory.status"),
            cell: (p) => (
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  p.aReponer ? "bg-expired-soft text-expired-text" : "bg-secondary-container text-on-secondary-container"
                }`}
              >
                {p.aReponer ? t("inventory.reorderRequired") : t("inventory.inStock")}
              </span>
            ),
          },
          {
            key: "acciones",
            header: t("users.actions"),
            cell: (p) => (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handleEditar(p);
                }}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Pencil size={14} />
                {t("users.edit")}
              </button>
            ),
          },
        ]}
        data={data?.items}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        loadingLabel={t("common.loading")}
        emptyLabel={t("inventory.empty")}
        onRowClick={(producto) => {
          setTabDetalle("detalle");
          setProductoSeleccionadoId(producto.id);
        }}
      />

      {productoSeleccionado && (
        <ProductoDetalleModal
          producto={productoSeleccionado}
          onClose={() => setProductoSeleccionadoId(null)}
          onEdit={() => handleEditar(productoSeleccionado)}
          tab={tabDetalle}
          setTab={setTabDetalle}
        />
      )}

      {productoLotes && <LotesRapidoModal producto={productoLotes} onClose={() => setProductoLotesId(null)} />}

      {fotoCelularDestino && (
        <FotoDesdeCelularModal
          onClose={() => setFotoCelularDestino(null)}
          onFoto={(file) => {
            const preview = URL.createObjectURL(file);
            if (fotoCelularDestino === "quick") {
              setQuickImageFile(file);
              setQuickImagePreview(preview);
            } else {
              setNuevaImagenFile(file);
              setNuevaImagenPreview(preview);
            }
          }}
        />
      )}

      <BarcodeScannerModal
        open={scannerDestino !== null}
        onClose={() => setScannerDestino(null)}
        onDetected={(codigo) => {
          // Con el celular ya vinculado, un código puede llegar sin que se
          // haya tocado el ícono de escanear (queda escuchando solo). En
          // ese caso, si el formulario de alta/edición está abierto va al
          // código de barras del producto; si no, se usa para buscar.
          const destino = scannerDestino ?? (showQuickCreate ? "quick" : showForm ? "form" : "search");
          if (destino === "quick") {
            setQuickForm((f) => ({ ...f, codigoBarras: codigo }));
          } else if (destino === "form") {
            setForm((f) => ({ ...f, codigoBarras: codigo }));
          } else {
            setSearch(codigo);
          }
          setScannerDestino(null);
        }}
      />
    </div>
  );
}

function ProductoDetalleModal({
  producto,
  onClose,
  onEdit,
  tab,
  setTab,
}: {
  producto: Producto;
  onClose: () => void;
  onEdit: () => void;
  tab: "detalle" | "stock";
  setTab: (tab: "detalle" | "stock") => void;
}) {
  const { t } = useTranslation();
  const categoria = producto.categoria?.nombre ?? "—";
  const unidad = producto.unidadMedida?.nombre ?? "—";
  const proveedor = null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/10 bg-surface-container-lowest shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
        <div className="border-b border-outline-variant/30 bg-gradient-to-r from-primary/10 via-surface-container-lowest to-transparent">
          <div className="flex items-start justify-between gap-4 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-outline-variant/40 bg-primary/10 text-lg font-semibold text-primary">
                {producto.imagenUrl ? (
                  <img src={resolveAssetUrl(producto.imagenUrl) ?? productPlaceholder} alt={producto.nombre} className="h-full w-full object-cover" />
                ) : (
                  producto.nombre.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-on-surface-variant">{t("inventory.sku")}</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-on-surface">{producto.nombre}</h2>
                <p className="mt-1 font-data text-sm text-on-surface-variant">{producto.sku}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-sm font-medium text-on-surface-variant transition hover:border-primary/60 hover:text-primary"
              >
                <Pencil size={16} />
                {t("users.edit")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 px-6 pb-4">
            <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-medium text-on-secondary-container">
              Stock: {producto.stockActual}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                producto.aReponer ? "bg-expired-soft text-expired-text" : "bg-primary/10 text-primary"
              }`}
            >
              {producto.aReponer ? "Requiere reposición" : "En stock"}
            </span>
            <span className="rounded-full border border-outline-variant bg-surface-container px-3 py-1 text-xs font-medium text-on-surface-variant">
              {producto.activo ? "Activo" : "Inactivo"}
            </span>
          </div>

          <div className="px-6 pb-4 pt-1">
            <div className="inline-flex rounded-full border border-outline-variant/50 bg-surface-container p-1">
              <button
                type="button"
                onClick={() => setTab("detalle")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  tab === "detalle" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant"
                }`}
              >
                Detalle
              </button>
              <button
                type="button"
                onClick={() => setTab("stock")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  tab === "stock" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant"
                }`}
              >
                Stock
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {tab === "detalle" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">Nombre</p>
                <p className="mt-2 font-medium text-on-surface">{producto.nombre}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">SKU</p>
                <p className="mt-2 font-data text-on-surface">{producto.sku}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">Stock actual</p>
                <p className="mt-2 text-2xl font-semibold text-on-surface">{producto.stockActual}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">Marca</p>
                <p className="mt-2 text-on-surface">{producto.marca ?? "—"}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">Categoría</p>
                <p className="mt-2 text-on-surface">{categoria}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">Unidad</p>
                <p className="mt-2 text-on-surface">{unidad}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4 sm:col-span-2 xl:col-span-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">Descripción</p>
                <p className="mt-2 whitespace-pre-line text-on-surface">{producto.descripcion ?? "—"}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">Stock mínimo</p>
                <p className="mt-2 font-data text-on-surface">{producto.stockMinimo}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">Punto de reposición</p>
                <p className="mt-2 font-data text-on-surface">{producto.puntoReposicion}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">Controla lote</p>
                <p className="mt-2 text-on-surface">{producto.controlaLote ? "Sí" : "No"}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">Controla vencimiento</p>
                <p className="mt-2 text-on-surface">{producto.controlaVencimiento ? "Sí" : "No"}</p>
              </div>
              {producto.controlaVencimiento && (
                <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
                    {t("inventory.form.expiryWarningDays")}
                  </p>
                  <p className="mt-2 font-data text-on-surface">{producto.diasAvisoVencimiento}</p>
                </div>
              )}
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-4 opacity-60">
                <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
                  <Lock size={11} />
                  Fecha de creación
                </p>
                <p className="mt-2 font-data text-on-surface-variant">{new Date(producto.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ) : (
            <StockProducto producto={producto} conCarga={false} />
          )}
        </div>
      </div>
    </div>
  );
}

function LotesRapidoModal({ producto, onClose }: { producto: Producto; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-surface-container-lowest shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/30 p-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-on-surface-variant">Stock por almacén y lote</p>
            <h2 className="mt-1 text-xl font-semibold text-on-surface">{producto.nombre}</h2>
            <p className="mt-1 font-data text-sm text-on-surface-variant">{producto.sku}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <StockProducto producto={producto} conCarga={false} />
        </div>
      </div>
    </div>
  );
}

function CategoryManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data: categorias } = useQuery({
    queryKey: ["categorias-planas"],
    queryFn: async () => (await apiClient.get<Categoria[]>("/categorias/planas")).data,
  });

  const crear = useMutation({
    mutationFn: async () => (await apiClient.post<Categoria>("/categorias", { nombre })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias-planas"] });
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      setNombre("");
      setError(null);
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("inventory.form.createError")),
  });

  return (
    <div className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (nombre.trim()) crear.mutate();
        }}
        className="mb-3 flex gap-2"
      >
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={t("inventory.categoryName")}
          className="flex-1 rounded-md border border-outline-variant px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={crear.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
        >
          {t("inventory.addCategory")}
        </button>
      </form>
      {error && <p className="mb-3 text-sm text-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {categorias?.map((c) => (
          <span
            key={c.id}
            className="rounded-full bg-surface-container px-3 py-1 text-xs font-medium text-on-surface-variant"
          >
            {c.nombre}
          </span>
        ))}
      </div>
    </div>
  );
}

function ImportPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    aCrear: number;
    aActualizar: number;
    errores: { fila: number; mensaje: string }[];
    aplicado: boolean;
  } | null>(null);

  async function enviar(aplicar: boolean) {
    if (!file) return;
    const form = new FormData();
    form.append("archivo", file);
    const res = await apiClient.post(`/importar-exportar/productos/importar?aplicar=${aplicar}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setPreview(res.data);
    if (aplicar) queryClient.invalidateQueries({ queryKey: ["productos"] });
  }

  return (
    <div className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4">
      <p className="mb-3 text-xs text-on-surface-variant">{t("inventory.importHint")}</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
          }}
          className="text-sm"
        />
        <button
          type="button"
          disabled={!file}
          onClick={() => enviar(false)}
          className="rounded-md border border-outline-variant px-3 py-1.5 text-sm font-medium text-on-surface-variant disabled:opacity-50"
        >
          {t("inventory.importPreview")}
        </button>
        {preview && !preview.aplicado && preview.errores.length === 0 && (
          <button
            type="button"
            onClick={() => enviar(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
          >
            {t("inventory.importApply")}
          </button>
        )}
      </div>
      {preview && (
        <div className="text-sm">
          <p>
            {t("inventory.importToCreate")}: <strong>{preview.aCrear}</strong> · {t("inventory.importToUpdate")}:{" "}
            <strong>{preview.aActualizar}</strong>
          </p>
          {preview.errores.length > 0 && (
            <div className="mt-2 text-error">
              <p className="font-medium">{t("inventory.importErrors")}:</p>
              <ul className="list-inside list-disc">
                {preview.errores.map((e, i) => (
                  <li key={i}>
                    Fila {e.fila}: {e.mensaje}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.aplicado && <p className="mt-2 text-secondary">✓ {t("settings.saved")}</p>}
        </div>
      )}
    </div>
  );
}
