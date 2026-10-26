import { useEffect, useRef, useState } from "react";

/**
 * The server's price for a length of time, kept in step with what is on the
 * form (2026-10-25).
 *
 * The panel never multiplies a rate by minutes itself: the figure is asked of
 * the endpoint that uses the same rate and formula as the write it previews.
 * Asked after a short pause, so typing "120" is one request, not three; and an
 * answer that comes back for a value the form has since moved past is
 * dropped, so a slow reply for "12" can never sit beside "120".
 *
 * `ok` carries the input it is FOR — minutes, or a clock time "00:40"
 * (2026-10-26): a caller enables its confirm only when that matches what is
 * on screen, so nothing is confirmed on a stale figure.
 */
export type QuoteState<T, K extends number | string = number> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; input: K; value: T }
  | { status: "error"; message: string };

export const QUOTE_DEBOUNCE_MS = 250;

export const useServerQuote = <T, K extends number | string = number>(
  input: K | null,
  fetchQuote: (input: K) => Promise<T>,
  /** Anything else the price depends on (the session, the seat, a typed rate). */
  key: string,
  /**
   * Bumped to ask the same question again (2026-10-26: "until 00:40" is a
   * minute shorter every minute). The figure on screen stays while the fresh
   * one is asked — it is still the answer for exactly this input — so a
   * confirm never blinks off once a minute.
   */
  refresh: number = 0,
): QuoteState<T, K> => {
  const [state, setState] = useState<QuoteState<T, K>>({ status: "idle" });
  const seq = useRef(0);
  const asked = useRef<{ input: K | null; key: string } | null>(null);
  const fetchRef = useRef(fetchQuote);
  fetchRef.current = fetchQuote;

  useEffect(() => {
    const mine = ++seq.current;
    const same = asked.current !== null && asked.current.input === input && asked.current.key === key;
    asked.current = { input, key };
    if (input === null) {
      setState({ status: "idle" });
      return;
    }
    // A refresh of the same question keeps the answer on screen; anything
    // else the old answer is not for, so it goes.
    if (!same) setState({ status: "loading" });
    const timer = setTimeout(() => {
      fetchRef.current(input)
        .then((value) => {
          if (seq.current === mine) setState({ status: "ok", input, value });
        })
        .catch((e: unknown) => {
          if (seq.current === mine) {
            setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
          }
        });
    }, QUOTE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [input, key, refresh]);

  return state;
};

/** The quoted value, only when it is for exactly this input. */
export const quoteFor = <T, K extends number | string = number>(state: QuoteState<T, K>, input: K | null): T | null =>
  state.status === "ok" && input !== null && state.input === input ? state.value : null;
