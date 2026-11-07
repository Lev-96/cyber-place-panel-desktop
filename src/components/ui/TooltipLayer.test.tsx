// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TooltipLayer, { placeTooltip } from "./TooltipLayer";

/**
 * The one tooltip (2026-11-07): it shows quickly on hover or keyboard focus,
 * never on a press or a drag, never leaves the window, and the native title
 * is back exactly as it was once it is gone.
 */
describe("placeTooltip", () => {
  const vp = { width: 1000, height: 800 };
  const bubble = { width: 100, height: 30 };

  test("centred above when there is room", () => {
    expect(placeTooltip({ left: 450, top: 400, width: 100, height: 40 }, bubble, vp)).toEqual({ left: 450, top: 362, side: "top" });
  });

  test("below when the element is at the top of the window", () => {
    expect(placeTooltip({ left: 450, top: 10, width: 100, height: 40 }, bubble, vp)).toEqual({ left: 450, top: 58, side: "bottom" });
  });

  test("slid inside the window at both edges", () => {
    expect(placeTooltip({ left: 0, top: 400, width: 20, height: 20 }, bubble, vp).left).toBe(8);
    expect(placeTooltip({ left: 990, top: 400, width: 10, height: 20 }, bubble, vp).left).toBe(892);
  });
});

describe("TooltipLayer", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  const board = () => render(
    <>
      <TooltipLayer />
      <div data-tip-scope>
        <button type="button" title="Добавить время" aria-label="Добавить время"><span>+</span></button>
      </div>
      <button type="button" title="Outside">Outside</button>
      <span data-tip="Anywhere">tip</span>
    </>,
  );

  const hover = (el: Element) => { fireEvent.pointerOver(el, { pointerType: "mouse" }); };

  test("hover inside the scope shows the title as a bubble and parks the native one", () => {
    board();
    const btn = screen.getByRole("button", { name: "Добавить время" });
    hover(btn.firstElementChild!);
    expect(btn.hasAttribute("title")).toBe(false);
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByRole("tooltip").textContent).toBe("Добавить время");
    expect(btn.getAttribute("aria-describedby")).toBe("cp-tooltip");

    fireEvent.pointerOut(btn, { relatedTarget: document.body });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(btn.getAttribute("title")).toBe("Добавить время");
    expect(btn.hasAttribute("aria-describedby")).toBe(false);
  });

  test("a press hides it and nothing shows while the button is down (click, drag)", () => {
    board();
    const btn = screen.getByRole("button", { name: "Добавить время" });
    hover(btn);
    act(() => { vi.advanceTimersByTime(250); });
    fireEvent.pointerDown(btn);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(btn.getAttribute("title")).toBe("Добавить время");

    hover(btn);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.pointerUp(btn);
  });

  test("Escape hides it", () => {
    board();
    hover(screen.getByText("tip"));
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByRole("tooltip").textContent).toBe("Anywhere");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  test("a title outside any scope keeps the native tooltip", () => {
    board();
    const outside = screen.getByRole("button", { name: "Outside" });
    hover(outside);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(outside.getAttribute("title")).toBe("Outside");
  });

  test("touch never shows one", () => {
    board();
    fireEvent.pointerOver(screen.getByText("tip"), { pointerType: "touch" });
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
