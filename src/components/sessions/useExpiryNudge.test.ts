// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ISessionApi } from "@/types/sessions";
import { useExpiryNudge } from "./useExpiryNudge";

/**
 * Asking the server AT the deadline, instead of on the next thirty-second tick.
 *
 * The backend's expiry is exact — `ends_at <= now`, priced at `ends_at` — but it
 * rides a request rather than a schedule. With the board's poll as the only
 * carrier, a tile's countdown reached 00:00 and the seat stayed busy for the
 * rest of the interval. This is one timeout aimed at an instant the client
 * already knows, and the server still decides what happens.
 */
describe("waking at a seat's deadline", () => {
  const NOW = Date.parse("2026-09-08T14:00:00.000Z");

  const seat = (over: Partial<ISessionApi> = {}): ISessionApi => ({
    id: 1,
    status: "active",
    ends_at: new Date(NOW + 10 * 60_000).toISOString(),
    is_unlimited: false,
    ...over,
  } as ISessionApi);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  test("does not ask before the deadline", async () => {
    const onDue = vi.fn();
    renderHook(() => useExpiryNudge([seat()], onDue));

    // 9:59 in. Still the venue's time to sell.
    await act(async () => { await vi.advanceTimersByTimeAsync(9 * 60_000 + 59_000); });

    expect(onDue).not.toHaveBeenCalled();
  });

  test("asks once the deadline passes", async () => {
    const onDue = vi.fn();
    renderHook(() => useExpiryNudge([seat()], onDue));

    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000 + 500); });

    expect(onDue).toHaveBeenCalledTimes(1);
  });

  test("asks immediately for a seat whose time has already gone", async () => {
    const onDue = vi.fn();
    // The board is showing a seat the server has not been asked about yet.
    renderHook(() => useExpiryNudge([seat({ ends_at: new Date(NOW - 60_000).toISOString() })], onDue));

    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(onDue).toHaveBeenCalledTimes(1);
  });

  test("waits for the SOONEST of several seats", async () => {
    const onDue = vi.fn();
    renderHook(() => useExpiryNudge([
      seat({ id: 1, ends_at: new Date(NOW + 30 * 60_000).toISOString() }),
      seat({ id: 2, ends_at: new Date(NOW + 5 * 60_000).toISOString() }),
      seat({ id: 3, ends_at: new Date(NOW + 12 * 60_000).toISOString() }),
    ], onDue));

    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000 + 500); });

    // The re-read that follows arms the next one; twenty seats cost twenty
    // wake-ups across an evening, not twenty timers at once.
    expect(onDue).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["a session with no end", { ends_at: null }],
    ["one already unlimited", { is_unlimited: true }],
    ["one that is over", { status: "stopped" as const }],
  ])("never wakes for %s", async (_name, over) => {
    const onDue = vi.fn();
    renderHook(() => useExpiryNudge([seat(over)], onDue));

    await act(async () => { await vi.advanceTimersByTimeAsync(60 * 60_000); });

    expect(onDue).not.toHaveBeenCalled();
  });

  test("a poll that changes nothing does not re-arm the wait", async () => {
    const onDue = vi.fn();
    const { rerender } = renderHook(({ list }) => useExpiryNudge(list, onDue), {
      initialProps: { list: [seat()] },
    });

    // Nine minutes in, the 30s poll returns an equal-but-new array. Re-arming
    // on array identity would restart the wait here and the seat would never
    // reach its deadline.
    await act(async () => { await vi.advanceTimersByTimeAsync(9 * 60_000); });
    rerender({ list: [seat()] });
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000 + 500); });

    expect(onDue).toHaveBeenCalledTimes(1);
  });

  test("an extension moves the wake-up out with it", async () => {
    const onDue = vi.fn();
    const { rerender } = renderHook(({ list }) => useExpiryNudge(list, onDue), {
      initialProps: { list: [seat()] },
    });

    // Five minutes in, +10 granted: the end is now twenty minutes from the
    // start, and nothing must fire at the old one.
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000); });
    rerender({ list: [seat({ ends_at: new Date(NOW + 20 * 60_000).toISOString() })] });

    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000 + 1000); });
    expect(onDue).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000); });
    expect(onDue).toHaveBeenCalledTimes(1);
  });
});
