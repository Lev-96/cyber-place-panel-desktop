// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useKeyedBusy } from "./useKeyedBusy";

describe("useKeyedBusy", () => {
  test("a second claim on the SAME key is refused until it is released", () => {
    const { result } = renderHook(() => useKeyedBusy());

    let first = false;
    let second = true;
    act(() => {
      // Both inside one act, before any re-render: the ref must decide.
      first = result.current.begin(1);
      second = result.current.begin(1);
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(result.current.isBusy(1)).toBe(true);

    act(() => result.current.end(1));
    expect(result.current.isBusy(1)).toBe(false);
    act(() => { expect(result.current.begin(1)).toBe(true); });
  });

  test("ANOTHER key goes through while the first is in flight", () => {
    const { result } = renderHook(() => useKeyedBusy());

    act(() => { result.current.begin(1); });
    let other = false;
    act(() => { other = result.current.begin(2); });

    expect(other).toBe(true);
    expect(result.current.isBusy(1)).toBe(true);
    expect(result.current.isBusy(2)).toBe(true);

    act(() => result.current.end(1));
    expect(result.current.isBusy(1)).toBe(false);
    expect(result.current.isBusy(2)).toBe(true);
  });
});
