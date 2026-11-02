import { useEffect, useState } from "react";

/**
 * Devuelve `value` con retraso. Útil en TV: al recorrer cards con el D-pad
 * evita re-renderizar fondos/paneles pesados en cada foco intermedio.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
