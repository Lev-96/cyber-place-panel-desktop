import { useEffect, useState } from "react";

/** Returns the input value after `delay` ms of inactivity. */
export const useDebouncedValue = <T>(value: T, delay = 500): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};
