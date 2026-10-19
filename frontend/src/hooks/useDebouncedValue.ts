import { useEffect, useState } from "react";

/**
 * Devuelve `value` recién después de que pase `delayMs` sin que cambie.
 *
 * Se usa para no disparar un pedido al backend por cada tecla escrita en un
 * buscador: sin esto, tipear rápido (como hace un lector físico de código de
 * barras, que "tipea" el código completo en milisegundos) dispara un pedido
 * por cada carácter, todos contra la misma base remota; se amontonan y el
 * que corresponde al texto final puede tardar mucho o perderse en el medio,
 * dando la sensación de que la búsqueda "no encuentra nada".
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
