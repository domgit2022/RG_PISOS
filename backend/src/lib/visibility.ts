/**
 * Spec (sección 2.1): Vendedor y Solo lectura no deben ver costos de
 * proveedor. Se usa para ocultar costoPromedio en listados que sí exponen
 * precios de venta al resto de los roles.
 */
export function ocultarCostoSiCorresponde<T extends { costoPromedio?: unknown }>(
  items: T[],
  permisos: string[]
): T[] {
  if (permisos.includes("productos.ver_costo")) return items;
  return items.map(({ costoPromedio: _costoPromedio, ...resto }) => resto as T);
}
