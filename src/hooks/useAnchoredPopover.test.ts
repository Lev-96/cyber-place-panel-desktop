// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAnchoredPopover } from "./useAnchoredPopover";

/**
 * The account switcher used to be cut off at the sidebar's edge — the sidebar
 * clips its children, and the panel is wider than the card it hangs off. It is
 * anchored to the WINDOW now, and these pin the arithmetic that keeps it there:
 * nothing may hang past an edge, at any window size.
 *
 * Rects are in CSS pixels, which is why there is no DPI case here: at 125% or
 * 150% Windows scaling the browser reports the same numbers in the same units,
 * and a rule that holds for these holds for those.
 */

const anchorAt = (rect: Partial<DOMRect>) => {
  const el = document.createElement("button");
  el.getBoundingClientRect = () => ({
    left: 8, right: 224, top: 700, bottom: 750, width: 216, height: 50, x: 8, y: 700,
    toJSON: () => ({}),
  } as DOMRect);
  Object.assign(el, {});
  if (Object.keys(rect).length) {
    el.getBoundingClientRect = () => ({
      left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
      toJSON: () => ({}), ...rect,
    } as DOMRect);
  }
  return { current: el };
};

const sizeWindow = (w: number, h: number) => {
  Object.defineProperty(window, "innerWidth", { value: w, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: h, configurable: true });
};

beforeEach(() => sizeWindow(1440, 900));
afterEach(() => vi.restoreAllMocks());

describe("useAnchoredPopover", () => {
  test("sits above the card, aligned with its left edge", () => {
    const ref = anchorAt({ left: 8, right: 224, top: 700, bottom: 750 });
    const { result } = renderHook(() => useAnchoredPopover(ref, true, 320));

    expect(result.current?.style.position).toBe("fixed");
    expect(result.current?.style.left).toBe(8);
    // Bottom-anchored, 6px above the card's top edge.
    expect(result.current?.style.bottom).toBe(900 - 700 + 6);
  });

  test("a card near the right edge pulls the panel back inside", () => {
    // 320px starting at x=1300 would end at 1620, past a 1440px window.
    const ref = anchorAt({ left: 1300, right: 1430, top: 700, bottom: 750 });
    const { result } = renderHook(() => useAnchoredPopover(ref, true, 320));

    const left = result.current!.style.left;
    expect(left + 320).toBeLessThanOrEqual(1440);
    expect(left).toBe(1440 - 320 - 8);
  });

  test("a window narrower than the panel still starts inside it", () => {
    sizeWindow(300, 600);
    const ref = anchorAt({ left: 8, right: 224, top: 400, bottom: 450 });
    const { result } = renderHook(() => useAnchoredPopover(ref, true, 320));

    expect(result.current!.style.left).toBeGreaterThanOrEqual(0);
    expect(result.current!.style.left).toBe(8);
  });

  test("no room above flips it below the card", () => {
    const ref = anchorAt({ left: 8, right: 224, top: 40, bottom: 90 });
    const { result } = renderHook(() => useAnchoredPopover(ref, true, 320));

    expect(result.current!.style.top).toBe(96);
    expect(result.current!.style.bottom).toBeUndefined();
  });

  test("it is given a height that fits the side it chose", () => {
    // More room below than above, so it goes below — and its height is what
    // is actually there, not what it would like.
    const ref = anchorAt({ left: 8, right: 224, top: 300, bottom: 350 });
    const { result } = renderHook(() => useAnchoredPopover(ref, true, 320));

    const { top, maxHeight } = result.current!.style;
    expect(top).toBe(356);
    expect(maxHeight).toBeLessThanOrEqual(900 - 356);
    expect(maxHeight).toBeGreaterThan(0);
  });

  test("a cramped card still gets a usable panel rather than a sliver", () => {
    sizeWindow(1440, 420);
    const ref = anchorAt({ left: 8, right: 224, top: 200, bottom: 250 });
    const { result } = renderHook(() => useAnchoredPopover(ref, true, 320));

    // Whichever side it picks, it is never told to be a few pixels tall: the
    // panel scrolls instead of collapsing.
    expect(result.current!.style.maxHeight).toBeGreaterThanOrEqual(120);
  });

  test("closed means no position at all", () => {
    const ref = anchorAt({ left: 8, right: 224, top: 700, bottom: 750 });
    const { result } = renderHook(() => useAnchoredPopover(ref, false, 320));

    expect(result.current).toBeNull();
  });
});
