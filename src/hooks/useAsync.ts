import { useCallback, useEffect, useState } from "react";

interface State<T> { data: T | null; loading: boolean; error: Error | null; }

export const useAsync = <T,>(fn: () => Promise<T>, deps: unknown[]) => {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });

  const run = useCallback(async () => {
    setState((s) => ({ data: s.data, loading: true, error: null }));
    try {
      const data = await fn();
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ data: s.data, loading: false, error: e instanceof Error ? e : new Error(String(e)) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { void run(); }, [run]);

  return { ...state, reload: run };
};
