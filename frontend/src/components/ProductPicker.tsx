import { useMemo, useState } from "react";
import { Search, ScanBarcode } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import type { Producto } from "@/lib/types";

interface ProductPickerProps {
  productos: Producto[] | undefined;
  value: string;
  onChange: (productoId: string) => void;
  placeholder?: string;
}

/**
 * Buscador rápido de producto por número (SKU), descripción o código de
 * barras, con lista de resultados desplegable. También admite escanear el
 * código con la cámara (botón) o con un lector físico USB/Bluetooth: estos
 * "tipean" el código y mandan Enter, lo que dispara la misma búsqueda exacta.
 */
export function ProductPicker({ productos, value, onChange, placeholder }: ProductPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  // Producto resuelto por código de barras exacto que no estaba en la lista
  // recibida por props (por ej. si el listado del padre viene paginado).
  const [extra, setExtra] = useState<Producto | null>(null);

  const seleccionado = productos?.find((p) => p.id === value) ?? (extra?.id === value ? extra : null);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const lista = productos ?? [];
    if (!q) return lista.slice(0, 30);
    return lista
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.codigoBarras ?? "").toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [productos, query]);

  async function seleccionarPorCodigoBarras(codigo: string) {
    const texto = codigo.trim();
    if (!texto) return;

    const local = (productos ?? []).find((p) => p.codigoBarras === texto);
    if (local) {
      onChange(local.id);
      setQuery("");
      setOpen(false);
      setErrorCodigo(null);
      return;
    }

    setBuscandoCodigo(true);
    setErrorCodigo(null);
    try {
      const producto = (await apiClient.get<Producto>(`/productos/codigo/${encodeURIComponent(texto)}`)).data;
      setExtra(producto);
      onChange(producto.id);
      setQuery("");
      setOpen(false);
    } catch {
      setErrorCodigo(`Sin resultados para el código "${texto}"`);
    } finally {
      setBuscandoCodigo(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border border-outline-variant px-3 py-2 text-sm focus-within:border-primary">
        <Search size={14} className="shrink-0 text-on-surface-variant" />
        <input
          value={open ? query : seleccionado ? `${seleccionado.nombre} (${seleccionado.sku})` : ""}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange("");
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            // Los lectores físicos de código de barras "tipean" el código y
            // mandan Enter: si hay un único resultado exacto, lo seleccionamos.
            if (e.key === "Enter" && query.trim()) {
              e.preventDefault();
              void seleccionarPorCodigoBarras(query.trim());
            }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setScannerOpen(true)}
          title="Escanear código de barras"
          className="shrink-0 text-on-surface-variant hover:text-primary"
        >
          <ScanBarcode size={16} />
        </button>
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-outline-variant bg-surface-container-lowest shadow-lg">
          {buscandoCodigo && <p className="px-3 py-2 text-sm text-on-surface-variant">Buscando...</p>}
          {!buscandoCodigo && errorCodigo && <p className="px-3 py-2 text-sm text-error">{errorCodigo}</p>}
          {!buscandoCodigo && !errorCodigo && filtrados.length === 0 && (
            <p className="px-3 py-2 text-sm text-on-surface-variant">Sin resultados</p>
          )}
          {!buscandoCodigo &&
            filtrados.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-container"
              >
                <span className="text-on-surface">{p.nombre}</span>
                <span className="font-data text-xs text-on-surface-variant">{p.sku}</span>
              </button>
            ))}
        </div>
      )}

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(codigo) => {
          setScannerOpen(false);
          void seleccionarPorCodigoBarras(codigo);
        }}
      />
    </div>
  );
}
