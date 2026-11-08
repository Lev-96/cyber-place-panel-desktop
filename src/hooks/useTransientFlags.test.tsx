// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useTransientFlags } from "./useTransientFlags";

describe("useTransientFlags", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test("a flash is on for exactly its time, then off", () => {
    const { result } = renderHook(() => useTransientFlags<number>(5000));
    expect(result.current.isOn(1)).toBe(false);
    act(() => { result.current.flash(1); });
    expect(result.current.isOn(1)).toBe(true);
    act(() => { vi.advanceTimersByTime(4999); });
    expect(result.current.isOn(1)).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.isOn(1)).toBe(false);
  });

  test("a second flash of the same key restarts its clock", () => {
    const { result } = renderHook(() => useTransientFlags<number>(5000));
    act(() => { result.current.flash(1); });
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { result.current.flash(1); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.isOn(1)).toBe(true);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.isOn(1)).toBe(false);
  });

  test("keys run their own clocks", () => {
    const { result } = renderHook(() => useTransientFlags<number>(5000));
    act(() => { result.current.flash(1); });
    act(() => { vi.advanceTimersByTime(2000); });
    act(() => { result.current.flash(2); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.isOn(1)).toBe(false);
    expect(result.current.isOn(2)).toBe(true);
  });

  test("unmounting clears every timer", () => {
    const { result, unmount } = renderHook(() => useTransientFlags<number>(5000));
    act(() => { result.current.flash(1); result.current.flash(2); });
    expect(vi.getTimerCount()).toBe(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
