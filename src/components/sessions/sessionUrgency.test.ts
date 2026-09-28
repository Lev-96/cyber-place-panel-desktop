// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ISessionApi } from "@/types/sessions";
import { sessionUrgency, useSessionUrgency } from "./sessionUrgency";

const NOW = Date.parse("2026-09-25T12:00:00Z");
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();
const s = (over: Partial<ISessionApi>): ISessionApi => ({ id: 1, ends_at: at(30), paused_at: null, ...over } as ISessionApi);

describe("sessionUrgency", () => {
  test.each([
    ["an end 30 min away", s({}), "normal"],
    ["exactly 5 min", s({ ends_at: at(5) }), "warn"],
    ["2 min", s({ ends_at: at(2) }), "warn"],
    ["exactly 1 min", s({ ends_at: at(1) }), "crit"],
    ["already past", s({ ends_at: at(-1) }), "crit"],
    ["no end (open / unlimited)", s({ ends_at: null }), "none"],
    ["paused, even when the end is near", s({ ends_at: at(1), paused_at: at(-3) }), "paused"],
  ])("%s → %s", (_label, session, expected) => {
    expect(sessionUrgency(session, NOW)).toBe(expected);
  });
});

describe("useSessionUrgency", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  test("wakes at each threshold without a per-second tick", () => {
    const { result } = renderHook(() => useSessionUrgency(s({ ends_at: at(6) })));
    expect(result.current).toBe("normal");

    act(() => { vi.advanceTimersByTime(60_000 + 100); });
    expect(result.current).toBe("warn");

    act(() => { vi.advanceTimersByTime(4 * 60_000); });
    expect(result.current).toBe("crit");
  });

  test("a new end re-aims it", () => {
    const { result, rerender } = renderHook(({ sess }) => useSessionUrgency(sess), {
      initialProps: { sess: s({ ends_at: at(2) }) },
    });
    expect(result.current).toBe("warn");

    rerender({ sess: s({ ends_at: at(40) }) });
    expect(result.current).toBe("normal");
  });

  test("no session → null", () => {
    const { result } = renderHook(() => useSessionUrgency(undefined));
    expect(result.current).toBeNull();
  });
});
