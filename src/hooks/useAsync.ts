import { apiCache } from "@/api/client";
import { useCallback, useEffect, useRef, useState } from "react";

interface State<T> { data: T | null; loading: boolean; error: Error | null; }

/**
 * Generic async loader with two correctness guarantees on top of plain
 * `useEffect + setState`:
 *
 * 1. Out-of-order resolution is ignored. Every `run()` bumps a generation
 *    counter; only the response from the latest generation is allowed to
 *    commit state. So a slow first request can't overwrite a fast second
 *    one when deps change rapidly (filter-while-typing, polling, etc).
 *
 * 2. Resolution after unmount is dropped silently — no setState on a dead
 *    component (no React warning, no leaked re-renders).
 *
 * 3. A background refresh reaches the screen. The HTTP cache revalidates what
 *    it serves and says so when a body genuinely changed — usually because
 *    somebody else edited it. This re-runs then, which costs no network (the
 *    cache is already fresh) and one render, and is what stops a screen
 *    showing data that was correct a minute ago.
 *
 * The public shape (`{data, loading, error, reload}`) is unchanged.
 */
export const useAsync = <T,>(fn: () => Promise<T>, deps: unknown[]) => {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });
  const genRef = useRef(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const run = useCallback(async () => {
    const myGen = ++genRef.current;
    setState((s) => ({ data: s.data, loading: true, error: null }));
    try {
      const data = await fn();
      if (myGen !== genRef.current || !aliveRef.current) return;
      setState({ data, loading: false, error: null });
    } catch (e) {
      if (myGen !== genRef.current || !aliveRef.current) return;
      setState((s) => ({
        data: s.data,
        loading: false,
        error: e instanceof Error ? e : new Error(String(e)),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { void run(); }, [run]);

  // Only ever fires when a cached response actually differs from what was
  // held, so an unchanged endpoint re-renders nothing.
  useEffect(() => apiCache.subscribe(() => { void run(); }), [run]);

  return { ...state, reload: run };
};
