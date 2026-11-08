import { keyValueStore } from "@/infrastructure/KeyValueStore";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Which optional parts of a form a person has hidden (2026-11-05, owner:
 * "hide what is not needed in this dialog"), kept for them on this computer
 * under `storeKey` (`{ v: 1, hidden: [...] }`), like the board's spacing.
 *
 * Only ids in `parts` are ever read back, so a stored list from another
 * version cannot hide something unknown. Nothing is hidden until the store
 * answers, and a failed read or write leaves everything shown: hiding is a
 * convenience, never a requirement. No key (signed out): nothing is kept.
 *
 * What a hidden part does to the form is the caller's: it must put the part
 * back to its default, so nothing unseen changes what the form does.
 */
export interface HiddenParts<T extends string> {
  isShown: (id: T) => boolean;
  setShown: (id: T, shown: boolean) => void;
  hiddenCount: number;
}

export const readHidden = <T extends string>(stored: unknown, parts: readonly T[]): T[] => {
  if (!stored || typeof stored !== "object") return [];
  const doc = stored as { v?: unknown; hidden?: unknown };
  if (doc.v !== 1 || !Array.isArray(doc.hidden)) return [];
  return parts.filter((p) => (doc.hidden as unknown[]).includes(p));
};

export const useHiddenParts = <T extends string>(storeKey: string | null, parts: readonly T[]): HiddenParts<T> => {
  const [hidden, setHidden] = useState<readonly T[]>([]);
  // A change made before the store answered wins over what it answers.
  const touched = useRef(false);
  const partsKey = parts.join("|");

  useEffect(() => {
    touched.current = false;
    setHidden([]);
    if (!storeKey) return undefined;
    let live = true;
    keyValueStore.get<unknown>(storeKey)
      .then((stored) => { if (live && !touched.current) setHidden(readHidden(stored, parts)); })
      .catch(() => {});
    return () => { live = false; };
    // `parts` is read through its joined key, so a fresh array each render is no change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey, partsKey]);

  const setShown = useCallback((id: T, shown: boolean) => {
    touched.current = true;
    setHidden((prev) => (shown ? prev.filter((p) => p !== id) : prev.includes(id) ? prev : [...prev, id]));
  }, []);

  // Written after the change is on screen, outside the state updater; only
  // a change the person made is written, never what was just read.
  useEffect(() => {
    if (!storeKey || !touched.current) return;
    keyValueStore.set(storeKey, { v: 1, hidden }).catch(() => {});
  }, [storeKey, hidden]);

  const isShown = useCallback((id: T) => !hidden.includes(id), [hidden]);
  return { isShown, setShown, hiddenCount: hidden.length };
};
