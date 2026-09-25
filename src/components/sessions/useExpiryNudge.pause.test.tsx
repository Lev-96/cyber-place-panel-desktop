// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ISessionApi } from "@/types/sessions";
import { useExpiryNudge } from "./useExpiryNudge";

/**
 * A LIMITED pause is due at its limit: the board must read once then, which
 * is what lets the server resume it on the spot. An unlimited pause is never due.
 */

const paused = (autoResumeInMs: number | null): ISessionApi => {
  const pausedAt = new Date(Date.now() - 60_000).toISOString();
  return {
    id: 1, status: "active", ends_at: new Date(Date.now() + 3_600_000).toISOString(), is_unlimited: false,
    paused_at: pausedAt,
    pauses: [{
      paused_at: pausedAt, resumed_at: null,
      auto_resume_at: autoResumeInMs === null ? null : new Date(Date.now() + autoResumeInMs).toISOString(),
    }],
  } as unknown as ISessionApi;
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("useExpiryNudge — limited pauses", () => {
  test("wakes at the pause's limit", () => {
    const onDue = vi.fn();
    renderHook(() => useExpiryNudge([paused(5_000)], onDue));

    vi.advanceTimersByTime(4_000);
    expect(onDue).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_500);
    expect(onDue).toHaveBeenCalledTimes(1);
  });

  test("an unlimited pause is not due, however long it lasts", () => {
    const onDue = vi.fn();
    renderHook(() => useExpiryNudge([paused(null)], onDue));

    vi.advanceTimersByTime(24 * 3_600_000);
    expect(onDue).not.toHaveBeenCalled();
  });
});
