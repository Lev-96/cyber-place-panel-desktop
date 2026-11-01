// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { QUOTE_DEBOUNCE_MS, quoteFor, useServerQuote } from "./useServerQuote";

/**
 * The server's price kept in step with the form (2026-10-25), and asked again
 * each minute for "until 00:40" without blanking the figure (2026-10-26).
 */
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const flush = async () => {
  await act(async () => { vi.advanceTimersByTime(QUOTE_DEBOUNCE_MS + 1); });
  await act(async () => { await Promise.resolve(); });
};

describe("useServerQuote", () => {
  test("a refresh of the same question keeps the answer on screen until the new one comes", async () => {
    let n = 0;
    const fetch = vi.fn(() => Promise.resolve({ amount: ++n }));
    const { result, rerender } = renderHook(
      ({ input, refresh }) => useServerQuote<{ amount: number }, string>(input, fetch, "k", refresh),
      { initialProps: { input: "00:40" as string | null, refresh: 1 } },
    );
    await flush();
    expect(quoteFor(result.current, "00:40")).toEqual({ amount: 1 });

    rerender({ input: "00:40", refresh: 2 });
    // Still the answer for exactly "00:40": Start stays enabled.
    expect(quoteFor(result.current, "00:40")).toEqual({ amount: 1 });
    await flush();
    expect(quoteFor(result.current, "00:40")).toEqual({ amount: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("a different input is never answered by the old figure", async () => {
    const fetch = vi.fn((input: string) => Promise.resolve({ input }));
    const { result, rerender } = renderHook(
      ({ input }) => useServerQuote<{ input: string }, string>(input, fetch, "k", 0),
      { initialProps: { input: "00:40" as string | null } },
    );
    await flush();
    rerender({ input: "01:00" });
    expect(result.current.status).toBe("loading");
    expect(quoteFor(result.current, "01:00")).toBeNull();
    await flush();
    expect(quoteFor(result.current, "01:00")).toEqual({ input: "01:00" });
  });

  test("a change of what else the price depends on blanks the figure", async () => {
    const fetch = vi.fn(() => Promise.resolve({ amount: 1 }));
    const { result, rerender } = renderHook(
      ({ key }) => useServerQuote<{ amount: number }, number>(60, fetch, key),
      { initialProps: { key: "rate-1500" } },
    );
    await flush();
    rerender({ key: "rate-2000" });
    expect(result.current.status).toBe("loading");
  });
});
