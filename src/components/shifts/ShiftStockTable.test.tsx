// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { IShiftStock } from "@/types/shifts";
import ShiftStockTable from "./ShiftStockTable";

vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));

/**
 * «Остатки» (report v6, 2026-11-16): the server's rows and totals, in pieces,
 * drawn as they came — the evening of the backend's `ShiftReportStockTest`.
 */
const EVENING: IShiftStock = {
  rows: [
    { product_id: 2, name: "Chips", start: 5, received: 0, sold: 9, returned: 2, sold_net: 7, corrected: -1, remaining: -3 },
    { product_id: 1, name: "Cola", start: 20, received: 12, sold: 8, returned: 4, sold_net: 4, corrected: 0, remaining: 28 },
    { product_id: 3, name: "Juice", start: 7, received: 0, sold: 0, returned: 0, sold_net: 0, corrected: 0, remaining: 7 },
    { product_id: 5, name: "Lemonade", start: null, received: 10, sold: 1, returned: 0, sold_net: 1, corrected: 0, remaining: 9 },
  ],
  totals: { start: 32, received: 22, sold: 18, returned: 6, sold_net: 12, corrected: -1, remaining: 41 },
  count: 4,
  negative_count: 1,
};

afterEach(() => cleanup());

describe("ShiftStockTable", () => {
  test("every row as the server said it, «not counted» for a start that was not, and the totals", () => {
    render(<ShiftStockTable stock={EVENING} />);
    const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((c) => c.textContent);

    const rows = screen.getAllByTestId("shift-stock-row");
    expect(rows.map((r) => within(r).getByRole("rowheader").textContent)).toEqual(["Chips", "Cola", "Juice", "Lemonade"]);
    expect(cells(rows[0])).toEqual(["5", "0", "9", "2", "−1", "−3"]);
    expect(cells(rows[1])).toEqual(["20", "12", "8", "4", "0", "28"]);
    expect(cells(rows[3])).toEqual(["shift.stock.notCounted", "10", "1", "0", "0", "9"]);
    expect(cells(screen.getByTestId("shift-stock-total"))).toEqual(["32", "22", "18", "6", "−1", "41"]);
  });

  test("below zero is red and named under the table", () => {
    render(<ShiftStockTable stock={EVENING} />);
    const remaining = screen.getAllByTestId("shift-stock-remaining");
    expect(remaining.map((c) => c.classList.contains("is-negative"))).toEqual([true, false, false, false]);
    expect(screen.getByTestId("shift-stock-negative").textContent).toBe("shift.stock.negative");
  });

  test("a branch that counts nothing shows no table", () => {
    const { container } = render(<ShiftStockTable stock={{ rows: [], totals: { start: 0, received: 0, sold: 0, returned: 0, sold_net: 0, corrected: 0, remaining: 0 }, count: 0, negative_count: 0 }} />);
    expect(container.innerHTML).toBe("");
  });

  test("the table scrolls in its own viewport, never the page", () => {
    render(<ShiftStockTable stock={EVENING} />);
    const region = screen.getByRole("region", { name: "shift.stock" });
    expect(region.classList.contains("hs-scroll")).toBe(true);
    expect(region.getAttribute("tabindex")).toBe("0");
  });
});
