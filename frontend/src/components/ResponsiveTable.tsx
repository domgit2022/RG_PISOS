import type { ReactNode } from "react";

export interface ResponsiveTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Oculta la columna en la vista de tarjetas (mobile), para datos secundarios. */
  hideOnCard?: boolean;
  className?: string;
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveTableColumn<T>[];
  data: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading?: boolean;
  loadingLabel: string;
  emptyLabel: string;
  onRowClick?: (row: T) => void;
}

/**
 * Tabla que se muestra como tabla convencional en tablet/PC (md+) y como
 * lista de tarjetas apiladas en mobile (<768px), siguiendo el patrón de
 * diseño de referencia (Stitch): "Mobile: tables transform into cards".
 * Se centraliza acá para no duplicar esta lógica en cada pantalla.
 */
export function ResponsiveTable<T>({
  columns,
  data,
  rowKey,
  isLoading,
  loadingLabel,
  emptyLabel,
  onRowClick,
}: ResponsiveTableProps<T>) {
  const showEmpty = !isLoading && (!data || data.length === 0);

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-lowest">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-container text-left text-xs uppercase tracking-wide text-on-surface-variant">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-on-surface-variant" colSpan={columns.length}>
                  {loadingLabel}
                </td>
              </tr>
            )}
            {showEmpty && (
              <tr>
                <td className="px-4 py-6 text-on-surface-variant" colSpan={columns.length}>
                  {emptyLabel}
                </td>
              </tr>
            )}
            {data?.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={`cursor-pointer border-t border-outline-variant/30 hover:bg-surface-container-low ${onRowClick ? "transition-colors" : ""}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${col.className ?? ""}`}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-outline-variant/30 md:hidden">
        {isLoading && <p className="px-4 py-6 text-sm text-on-surface-variant">{loadingLabel}</p>}
        {showEmpty && <p className="px-4 py-6 text-sm text-on-surface-variant">{emptyLabel}</p>}
        {data?.map((row) => (
          <div
            key={rowKey(row)}
            onClick={() => onRowClick?.(row)}
            className={`space-y-1.5 p-4 ${onRowClick ? "cursor-pointer hover:bg-surface-container-low" : ""}`}
          >
            {columns
              .filter((col) => !col.hideOnCard)
              .map((col) => (
                <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="shrink-0 text-xs font-medium uppercase text-on-surface-variant">{col.header}</span>
                  <span className="text-right">{col.cell(row)}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
