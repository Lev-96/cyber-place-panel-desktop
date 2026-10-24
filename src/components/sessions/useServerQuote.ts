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
 * `ok` carries the minutes it is FOR: a caller enables its confirm only when
 * that matches what is on screen, so nothing is confirmed on a stale figure.
 */
export type QuoteState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; minutes: number; value: T }
  | { status: "error"; message: string };

export const QUOTE_DEBOUNCE_MS = 250;

export const useServerQuote = <T>(
  minutes: number | null,
  fetchQuote: (minutes: number) => Promise<T>,
  /** Anything else the price depends on (the session, the seat, a typed rate). */
  key: string,
): QuoteState<T> => {
  const [state, setState] = useState<QuoteState<T>>({ status: "idle" });
  const seq = useRef(0);
  const fetchRef = useRef(fetchQuote);
  fetchRef.current = fetchQuote;

  useEffect(() => {
    const mine = ++seq.current;
    if (minutes === null) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    const timer = setTimeout(() => {
      fetchRef.current(minutes)
        .then((value) => {
          if (seq.current === mine) setState({ status: "ok", minutes, value });
        })
        .catch((e: unknown) => {
          if (seq.current === mine) {
            setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
          }
        });
    }, QUOTE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [minutes, key]);

  return state;
};

/** The quoted value, only when it is for exactly these minutes. */
export const quoteFor = <T>(state: QuoteState<T>, minutes: number | null): T | null =>
  state.status === "ok" && minutes !== null && state.minutes === minutes ? state.value : null;
