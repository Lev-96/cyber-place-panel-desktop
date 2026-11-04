import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Flags that switch themselves off (2026-11-04): `flash(key)` turns one on for
 * `ms`, `isOn(key)` reads it. A second flash of the same key restarts its
 * clock, so the last press decides when it goes; flags on other keys run
 * their own clocks. Every timer is cleared on unmount — nothing fires into a
 * component that is gone.
 */
export const useTransientFlags = <K extends string | number>(ms: number) => {
  const [on, setOn] = useState<ReadonlySet<K>>(() => new Set());
  const timers = useRef(new Map<K, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const all = timers.current;
    return () => {
      for (const id of all.values()) clearTimeout(id);
      all.clear();
    };
  }, []);

  const flash = useCallback((key: K) => {
    const running = timers.current.get(key);
    if (running !== undefined) clearTimeout(running);
    timers.current.set(key, setTimeout(() => {
      timers.current.delete(key);
      setOn((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, ms));
    setOn((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, [ms]);

  const isOn = useCallback((key: K) => on.has(key), [on]);

  return { flash, isOn };
};
