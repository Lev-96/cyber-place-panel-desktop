import { useCallback, useRef, useState } from "react";

/**
 * "Is an action already in flight for THIS id?" — one guard per key.
 *
 * Built for the sessions board, where a cashier works several seats at once:
 * a second press on the SAME seat while its request is out must be one thing,
 * and a press on ANOTHER seat must go through. The board used to hold one
 * `number | null` per action, which did the first and silently dropped the
 * second (the other seat's press returned early — no request, no error).
 *
 * Two layers, each for its own reason:
 *  - a ref, checked and set synchronously by `begin`, so two clicks landing
 *    before the re-render cannot both start a request;
 *  - state, so the buttons of that key can render disabled.
 */
export interface KeyedBusy {
  /** Claim the key. False when it is already in flight — do nothing then. */
  begin: (id: number) => boolean;
  /** Release the key; always call it in `finally`. */
  end: (id: number) => void;
  /** Whether the key is in flight, for rendering. */
  isBusy: (id: number) => boolean;
}

export const useKeyedBusy = (): KeyedBusy => {
  const inFlight = useRef<Set<number>>(new Set());
  const [busy, setBusy] = useState<ReadonlySet<number>>(() => new Set());

  const begin = useCallback((id: number) => {
    if (inFlight.current.has(id)) return false;
    inFlight.current.add(id);
    setBusy(new Set(inFlight.current));
    return true;
  }, []);

  const end = useCallback((id: number) => {
    if (!inFlight.current.delete(id)) return;
    setBusy(new Set(inFlight.current));
  }, []);

  const isBusy = useCallback((id: number) => busy.has(id), [busy]);

  return { begin, end, isBusy };
};
