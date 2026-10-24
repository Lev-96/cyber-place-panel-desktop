import { describe, expect, test } from "vitest";
import { MIN_CONTENT, parseSavedWindow, restoredBounds } from "../electron/windowBounds";

/** The main window reopens where it was left — but never off screen or larger than it. */
const FHD = { x: 0, y: 0, width: 1920, height: 1040 };
const SECOND = { x: 1920, y: 0, width: 1280, height: 984 };
const saved = (over = {}) => ({ x: 100, y: 80, width: 1200, height: 800, maximized: false, ...over });

describe("parseSavedWindow", () => {
  test("reads what was written", () => {
    expect(parseSavedWindow(JSON.stringify(saved({ maximized: true })))).toEqual(saved({ maximized: true }));
  });

  test.each([null, "", "not json", "{}", JSON.stringify({ x: 1, y: 2, width: "w", height: 3 })])(
    "anything unreadable is nothing saved: %j",
    (raw) => { expect(parseSavedWindow(raw as string | null)).toBeNull(); },
  );
});

describe("restoredBounds", () => {
  test("nothing saved opens at the default", () => {
    expect(restoredBounds(null, [FHD])).toBeNull();
  });

  test("a window that fits is restored exactly, maximized or not", () => {
    expect(restoredBounds(saved(), [FHD])).toEqual(saved());
    expect(restoredBounds(saved({ maximized: true }), [FHD])?.maximized).toBe(true);
  });

  test("stays on the second monitor it was left on", () => {
    const there = saved({ x: 2000, y: 50, width: 1000, height: 700 });
    expect(restoredBounds(there, [FHD, SECOND])).toEqual(there);
  });

  test("a monitor unplugged since: not restored off screen", () => {
    expect(restoredBounds(saved({ x: 2000, y: 50 }), [FHD])).toBeNull();
  });

  test("a resolution lowered since: shrunk and moved back inside", () => {
    const small = { x: 0, y: 0, width: 1366, height: 728 };
    const r = restoredBounds(saved({ x: 900, y: 300, width: 1600, height: 1000 }), [small])!;
    expect(r.width).toBe(1366);
    expect(r.height).toBe(728);
    expect(r.x + r.width).toBeLessThanOrEqual(1366);
    expect(r.y + r.height).toBeLessThanOrEqual(728);
  });

  test("never below the panel's minimum", () => {
    const r = restoredBounds(saved({ width: 300, height: 200 }), [FHD])!;
    expect(r.width).toBe(MIN_CONTENT.width);
    expect(r.height).toBe(MIN_CONTENT.height);
  });
});
