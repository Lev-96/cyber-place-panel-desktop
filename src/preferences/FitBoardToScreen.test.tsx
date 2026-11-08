// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_PREFERENCES, PRESETS, type UiPreferences } from "./uiPreferences";

/**
 * A list kept whole across its width (2026-11-03): words, then pictures, then
 * the whole list zoomed, never below MIN_WIDTH_ZOOM. Only in list view; the
 * grid wraps. «Без прокрутки» (the height fit) was removed 2026-11-04.
 */
const prefs = vi.hoisted(() => ({ value: null as UiPreferences | null }));
vi.mock("@/preferences/UiPreferencesContext", () => ({
  useUiPreferencesOptional: () => (prefs.value ? { shown: prefs.value, layout: prefs.value.layout } : null),
}));

import FitBoardToScreen, { FIT_VAR, MIN_WIDTH_ZOOM, installBoardFit, widthZoom } from "./FitBoardToScreen";
import { ICONS_ATTR } from "./boardMeasure";

const frames = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 40)); }); };
const view = (board_view: "grid" | "list"): UiPreferences =>
  ({ ...DEFAULT_PREFERENCES, interface: "custom", layout: { ...PRESETS.standard, board_view } });

beforeEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("style");
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** `main.main` with a list whose widest row needs `natural` px in `room` px. */
const mainWithList = (natural: number, room: number) => {
  const main = document.createElement("main");
  main.className = "main";
  document.body.appendChild(main);
  const grid = document.createElement("div");
  grid.className = "live-grid--sessions";
  grid.getBoundingClientRect = () => ({ width: room } as DOMRect);
  const card = document.createElement("div");
  card.className = "place-cell";
  card.getBoundingClientRect = () => ({ width: natural * (Number(main.style.getPropertyValue(FIT_VAR)) || 1) } as DOMRect);
  grid.appendChild(card);
  main.appendChild(grid);
  return main;
};

describe("FitBoardToScreen", () => {
  test("list view: a row too wide for its room is fitted; leaving the screen takes it all away", async () => {
    const main = mainWithList(1000, 800);
    prefs.value = view("list");
    const rendered = render(<FitBoardToScreen />);
    await frames();
    expect(main.hasAttribute(ICONS_ATTR)).toBe(true);
    expect(Number(main.style.getPropertyValue(FIT_VAR))).toBe(0.8);
    rendered.unmount();
    expect(main.hasAttribute(ICONS_ATTR)).toBe(false);
    expect(main.style.getPropertyValue(FIT_VAR)).toBe("");
  });

  test("grid view: never touches anything (its cards wrap)", async () => {
    const main = mainWithList(1000, 500);
    prefs.value = view("grid");
    render(<FitBoardToScreen />);
    await frames();
    expect(main.hasAttribute(ICONS_ATTR)).toBe(false);
    expect(main.style.getPropertyValue(FIT_VAR)).toBe("");
  });

  test("no preferences at all (signed out): the grid default, nothing touched", async () => {
    const main = mainWithList(1000, 500);
    prefs.value = null;
    render(<FitBoardToScreen />);
    await frames();
    expect(main.style.getPropertyValue(FIT_VAR)).toBe("");
  });
});

describe("widthZoom: a list too wide for its room, scaled as a whole", () => {
  test("fits as it is: no zoom", () => {
    expect(widthZoom([{ natural: 700, room: 900 }])).toBe(1);
  });

  test("short of room: exactly room / natural, rounded down", () => {
    expect(widthZoom([{ natural: 1000, room: 750 }])).toBe(0.75);
    expect(widthZoom([{ natural: 1000, room: 755.9 }])).toBe(0.755);
  });

  test("several lists: the one that needs the most", () => {
    expect(widthZoom([{ natural: 800, room: 760 }, { natural: 1000, room: 700 }])).toBe(0.7);
  });

  test("never below the floor (a display that small scrolls instead)", () => {
    expect(widthZoom([{ natural: 3000, room: 600 }])).toBe(MIN_WIDTH_ZOOM);
  });

  test("half a pixel over is not a reason to shrink", () => {
    expect(widthZoom([{ natural: 900.4, room: 900 }])).toBe(1);
  });
});

describe("installBoardFit: the width fit on a real list", () => {
  /** A list whose widest row needs `natural` px at zoom 1, in `room` px. */
  const fakeList = (target: HTMLElement, natural: number, room: number) => {
    const grid = document.createElement("div");
    grid.className = "live-grid--sessions";
    grid.getBoundingClientRect = () => ({ width: room } as DOMRect);
    const card = document.createElement("div");
    card.className = "place-cell";
    // Its width follows the zoom in force, like a real zoomed row.
    card.getBoundingClientRect = () => ({ width: natural * (Number(target.style.getPropertyValue(FIT_VAR)) || 1) } as DOMRect);
    grid.appendChild(card);
    target.appendChild(grid);
  };

  test("a list wider than its room: scaled to fit, the same rows", async () => {
    const target = document.createElement("div"); document.body.appendChild(target);
    fakeList(target, 1000, 800);
    const off = installBoardFit(target);
    await frames();
    expect(Number(target.style.getPropertyValue(FIT_VAR))).toBe(0.8);
    off();
    expect(target.style.getPropertyValue(FIT_VAR)).toBe("");
  });

  test("measured unscaled every time: once there is room again, back to full size", async () => {
    const target = document.createElement("div"); document.body.appendChild(target);
    let room = 800;
    const grid = document.createElement("div");
    grid.className = "live-grid--sessions";
    grid.getBoundingClientRect = () => ({ width: room } as DOMRect);
    const card = document.createElement("div");
    card.className = "place-cell";
    card.getBoundingClientRect = () => ({ width: 1000 * (Number(target.style.getPropertyValue(FIT_VAR)) || 1) } as DOMRect);
    grid.appendChild(card); target.appendChild(grid);
    const off = installBoardFit(target);
    await frames();
    expect(Number(target.style.getPropertyValue(FIT_VAR))).toBe(0.8);
    room = 1200;
    await act(async () => { target.appendChild(document.createElement("span")); }); // anything that re-fits
    await frames();
    expect(target.style.getPropertyValue(FIT_VAR)).toBe("");
    off();
  });

  /**
   * A row that is `words` px with its buttons' words and `icons` px with
   * their pictures (2026-11-03), at zoom 1; it follows the zoom in force.
   */
  const fakeRow = (target: HTMLElement, words: number, icons: number, room: () => number) => {
    const grid = document.createElement("div");
    grid.className = "live-grid--sessions";
    grid.getBoundingClientRect = () => ({ width: room() } as DOMRect);
    const card = document.createElement("div");
    card.className = "place-cell";
    card.getBoundingClientRect = () => ({
      width: (target.hasAttribute(ICONS_ATTR) ? icons : words) * (Number(target.style.getPropertyValue(FIT_VAR)) || 1),
    } as DOMRect);
    grid.appendChild(card);
    target.appendChild(grid);
  };

  test("words fit: words, nothing else touched", async () => {
    const target = document.createElement("div"); document.body.appendChild(target);
    fakeRow(target, 1000, 700, () => 1100);
    const off = installBoardFit(target);
    await frames();
    expect(target.hasAttribute(ICONS_ATTR)).toBe(false);
    expect(target.style.getPropertyValue(FIT_VAR)).toBe("");
    off();
  });

  test("words do not fit, pictures do: pictures at full size, no zoom", async () => {
    const target = document.createElement("div"); document.body.appendChild(target);
    fakeRow(target, 1000, 700, () => 800);
    const off = installBoardFit(target);
    await frames();
    expect(target.hasAttribute(ICONS_ATTR)).toBe(true);
    expect(target.style.getPropertyValue(FIT_VAR)).toBe("");
    off();
    expect(target.hasAttribute(ICONS_ATTR)).toBe(false);
  });

  test("not even pictures fit: pictures, and the zoom THEY need (not the words')", async () => {
    const target = document.createElement("div"); document.body.appendChild(target);
    fakeRow(target, 1000, 700, () => 560);
    const off = installBoardFit(target);
    await frames();
    expect(target.hasAttribute(ICONS_ATTR)).toBe(true);
    expect(Number(target.style.getPropertyValue(FIT_VAR))).toBe(0.8);
    off();
  });

  test("room again: words come back (measured with words every time)", async () => {
    const target = document.createElement("div"); document.body.appendChild(target);
    let room = 800;
    fakeRow(target, 1000, 700, () => room);
    const off = installBoardFit(target);
    await frames();
    expect(target.hasAttribute(ICONS_ATTR)).toBe(true);
    room = 1100;
    await act(async () => { target.appendChild(document.createElement("span")); });
    await frames();
    expect(target.hasAttribute(ICONS_ATTR)).toBe(false);
    off();
  });

});
