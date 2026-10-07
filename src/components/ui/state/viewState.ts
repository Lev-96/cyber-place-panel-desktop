import { ApiError } from "@/api/client";
import { LocalizedText, textLiteral } from "@/i18n/localizedText";

/**
 * What a data screen shows, decided in ONE place so no screen hand-rolls the
 * order (2026-10-07). The order is the rule:
 *
 *   1. Data with something in it is shown — while a background reload runs AND
 *      after one fails (`staleError` lets the screen add a quiet notice). A
 *      refresh never blanks what the operator is looking at.
 *   2. An error with nothing to show → the error state (offline / not found /
 *      failed, see `classifyError`). An error is never dressed up as "empty".
 *   3. No data yet and a request in flight → loading (the screen's skeleton).
 *   4. An answered, empty list → `noResults` when a search or filter narrowed
 *      it, `empty` when there is genuinely nothing.
 */
export type ViewState =
  | { kind: "loading" }
  | { kind: "error"; error: unknown }
  | { kind: "empty" }
  | { kind: "noResults" }
  | { kind: "ready"; staleError: unknown };

export interface ViewInput<T> {
  loading: boolean;
  error: unknown;
  data: T | null | undefined;
  /** Whether a search / filter narrowed the request (→ noResults, not empty). */
  hasFilters?: boolean;
  /** Defaults to "an array with no items". */
  isEmpty?: (data: T) => boolean;
}

const defaultIsEmpty = (data: unknown): boolean => Array.isArray(data) && data.length === 0;

export const deriveViewState = <T,>({ loading, error, data, hasFilters = false, isEmpty }: ViewInput<T>): ViewState => {
  const hasError = error !== null && error !== undefined;
  if (data !== null && data !== undefined) {
    const empty = isEmpty ? isEmpty(data) : defaultIsEmpty(data);
    if (!empty) return { kind: "ready", staleError: hasError ? error : null };
    if (hasError) return { kind: "error", error };
    return { kind: hasFilters ? "noResults" : "empty" };
  }
  if (hasError) return { kind: "error", error };
  if (loading) return { kind: "loading" };
  return { kind: hasFilters ? "noResults" : "empty" };
};

/** Which error state a failure is. */
export type ErrorKind = "offline" | "notFound" | "error";

const statusOf = (e: unknown): number | undefined => {
  if (!e || typeof e !== "object") return undefined;
  const s = (e as Partial<ApiError>).status;
  return typeof s === "number" ? s : undefined;
};

/**
 * A request that got no answer (fetch's TypeError, a status of 0) or a machine
 * that says it is offline → `offline`; the server's 404 → `notFound`;
 * everything else → `error`. A status-less error that is NOT a TypeError is a
 * bug in our own code, not the network, and stays `error`.
 */
export const classifyError = (
  e: unknown,
  online: boolean = typeof navigator === "undefined" ? true : navigator.onLine !== false,
): ErrorKind => {
  const status = statusOf(e);
  if (status === 404) return "notFound";
  if (!online) return "offline";
  if (status === 0 || (status === undefined && e instanceof TypeError)) return "offline";
  return "error";
};

/**
 * The server's own sentence, as a secondary detail under our localised title —
 * only for a server answer (a status) that is not a 404, and only when it
 * carries one. Never `error.stack`, never a client-side exception's message.
 */
export const serverDetailOf = (e: unknown): LocalizedText | null => {
  const status = statusOf(e);
  if (!status || status === 404) return null;
  const body = (e as Partial<ApiError>).body;
  if (!body || typeof body !== "object") return null;
  const message = (body as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? textLiteral(message.trim()) : null;
};
