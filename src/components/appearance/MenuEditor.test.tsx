// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import type { NavItem } from "@/components/sidebarNav";
import type { SidebarEntry } from "@/preferences/uiPreferences";
import { installSortableTestEnv, rowCentre } from "@/hooks/useSortableList.testkit";

vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en", money: (n: number) => String(n) }) }));

import MenuEditor from "./MenuEditor";

/**
 * The side-menu editor by drag and drop (2026-11-13): Home stays first and
 * cannot be dragged; required entries move but stay shown; added shortcuts
 * are removed by their switch; onChange keeps the arrangement shape
 * (`{ id, hidden }` for every row but Home, in display order).
 */
let restore: () => void = () => {};
beforeAll(() => { restore = installSortableTestEnv((el) => el.dataset.testid?.startsWith("menu-row-") === true); });
afterAll(() => restore());
afterEach(() => cleanup());

const item = (id: string): NavItem => ({ id, to: `/${id}`, label: `${id}.label` });
const ITEMS = ["nav.dashboard", "nav.bookings", "nav.settings", "nav.shifts", "branch.sessions.9"].map(item);

const mount = (arrangement: SidebarEntry[] = []) => {
  const onChange = vi.fn<(next: SidebarEntry[]) => void>();
  render(<MenuEditor items={ITEMS} arrangement={arrangement} onChange={onChange} />);
  return onChange;
};
const grip = (id: string) => screen.getByTestId(`menu-grip-${id}`);
/** Rows sit after Home in the list, so row `i` (0-based, Home excluded) is child `i + 1`. */
const centreOfRow = (i: number) => rowCentre(i + 1);

describe("Home", () => {
  test("is first, has no grip and takes no part in sorting", () => {
    mount();
    const rows = within(screen.getByTestId("menu-editor")).getAllByRole("listitem");
    expect(rows[0].textContent).toContain("nav.dashboard.label");
    expect(within(rows[0]).queryByRole("button")).toBeNull();
    expect(rows[0].hasAttribute("data-sort-state")).toBe(false);
    expect(screen.queryByTestId("menu-grip-nav.dashboard")).toBeNull();
  });

  test("dragging the first row up past Home still leaves Home first and out of onChange", () => {
    const onChange = mount();
    fireEvent.pointerDown(grip("nav.shifts"), { clientY: centreOfRow(2), pointerId: 1, button: 0, isPrimary: true });
    fireEvent.pointerMove(grip("nav.shifts"), { clientY: -500, pointerId: 1 });
    fireEvent.pointerUp(grip("nav.shifts"), { clientY: -500, pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next.map((e) => e.id)).toEqual(["nav.shifts", "nav.bookings", "nav.settings", "branch.sessions.9"]);
    expect(next.some((e) => e.id === "nav.dashboard")).toBe(false);
  });
});

describe("rows", () => {
  test("a required row has a grip and can be moved, but its switch is disabled", () => {
    const onChange = mount();
    expect(grip("nav.settings").getAttribute("aria-label")).toBe("appearance.menu.move: nav.settings.label");
    expect(screen.getByTestId("menu-show-nav.settings")).toHaveProperty("disabled", true);
    fireEvent.pointerDown(grip("nav.settings"), { clientY: centreOfRow(1), pointerId: 1, button: 0, isPrimary: true });
    fireEvent.pointerMove(grip("nav.settings"), { clientY: centreOfRow(3), pointerId: 1 });
    fireEvent.pointerUp(grip("nav.settings"), { clientY: centreOfRow(3), pointerId: 1 });
    expect(onChange.mock.calls[0][0].map((e) => e.id)).toEqual(["nav.bookings", "nav.shifts", "branch.sessions.9", "nav.settings"]);
  });

  test("a pointer drag hands onChange the same arrangement shape, hidden flags kept", () => {
    const onChange = mount([{ id: "nav.bookings", hidden: true }, { id: "nav.settings", hidden: true }]);
    fireEvent.pointerDown(grip("nav.bookings"), { clientY: centreOfRow(0), pointerId: 1, button: 0, isPrimary: true });
    fireEvent.pointerMove(grip("nav.bookings"), { clientY: centreOfRow(2), pointerId: 1 });
    expect(screen.getByTestId("menu-row-nav.bookings").getAttribute("data-sort-state")).toBe("lifted");
    expect(screen.getByTestId("menu-row-nav.settings").getAttribute("data-sort-state")).toBe("shift-up");
    fireEvent.pointerUp(grip("nav.bookings"), { clientY: centreOfRow(2), pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    // Exactly { id, hidden } per row; a required row is never stored hidden.
    expect(onChange.mock.calls[0][0]).toEqual([
      { id: "nav.settings", hidden: false },
      { id: "nav.shifts", hidden: false },
      { id: "nav.bookings", hidden: true },
      { id: "branch.sessions.9", hidden: false },
    ]);
  });

  test("Escape mid-drag: no onChange", () => {
    const onChange = mount();
    fireEvent.pointerDown(grip("nav.bookings"), { clientY: centreOfRow(0), pointerId: 1, button: 0, isPrimary: true });
    fireEvent.pointerMove(grip("nav.bookings"), { clientY: centreOfRow(3), pointerId: 1 });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(grip("nav.bookings"), { clientY: centreOfRow(3), pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
  });

  test("by keyboard: Space, ArrowDown, Space moves one slot and is announced", () => {
    const onChange = mount();
    expect(grip("nav.bookings").getAttribute("aria-describedby")).toBeTruthy();
    fireEvent.keyDown(grip("nav.bookings"), { key: " " });
    expect(screen.getByTestId("menu-editor-live").textContent).toBe("appearance.menu.sort.pickedUp");
    fireEvent.keyDown(grip("nav.bookings"), { key: "ArrowDown" });
    fireEvent.keyDown(grip("nav.bookings"), { key: " " });
    expect(onChange.mock.calls[0][0]).toEqual([
      { id: "nav.settings", hidden: false },
      { id: "nav.bookings", hidden: false },
      { id: "nav.shifts", hidden: false },
      { id: "branch.sessions.9", hidden: false },
    ]);
  });

  test("the switch still hides a role entry and removes an added one, in the same shape", () => {
    const onChange = mount();
    fireEvent.click(screen.getByTestId("menu-show-nav.shifts"));
    expect(onChange.mock.calls[0][0]).toEqual([
      { id: "nav.bookings", hidden: false },
      { id: "nav.settings", hidden: false },
      { id: "nav.shifts", hidden: true },
      { id: "branch.sessions.9", hidden: false },
    ]);
    fireEvent.click(screen.getByTestId("menu-show-branch.sessions.9"));
    expect(onChange.mock.calls[1][0].map((e) => e.id)).toEqual(["nav.bookings", "nav.settings", "nav.shifts"]);
  });

  test("the old up / down buttons are gone", () => {
    mount();
    expect(screen.queryByRole("button", { name: /appearance\.menu\.(up|down)/ })).toBeNull();
  });
});
