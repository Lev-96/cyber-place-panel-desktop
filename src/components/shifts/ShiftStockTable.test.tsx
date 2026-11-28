// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { IAcceptanceCountBlind, IAcceptanceCountFull, IShiftStock, IStockHandover } from "@/types/shifts";
import ShiftStockTable from "./ShiftStockTable";

// The 2026-11-28 sentences keep their placeholders, so the values really reach the screen.
const SENTENCES = /^(shift\.handover\.(reason|acceptedBy)|shift\.stock\.(lostTotal|acceptedShort))$/;
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => (SENTENCES.test(k) ? `${k} {0}|{1}|{2}|{3}|{4}` : k), money: (n: number) => `${n.toFixed(2)} AMD` }),
}));

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

/**
 * The minus where it happened (2026-11-28, owner): the shortage the NEXT shift
 * found is shown in this shift's «Остатки» — what it counted, the difference in
 * red, one sentence per product — and the next shift's «Пересчёт» is said to
 * be the previous shift's shortage. The backend's ShiftAcceptanceCountTest
 * evening: Anna accepted Cola 10, sold 1 (9 left); Boris counted 8.
 */
describe("the shortage found at the next acceptance", () => {
  const ANNA: IShiftStock = {
    rows: [
      { product_id: 1, name: "Cola", start: 10, received: 0, sold: 1, returned: 0, sold_net: 1, corrected: 0, remaining: 9 },
      { product_id: 2, name: "Chips", start: 5, received: 0, sold: 0, returned: 0, sold_net: 0, corrected: 0, remaining: 5 },
    ],
    totals: { start: 15, received: 0, sold: 1, returned: 0, sold_net: 1, corrected: 0, remaining: 14 }, count: 2, negative_count: 0,
  };
  const count: IAcceptanceCountFull = {
    counted_at: "2026-11-18T10:00:00+04:00", counted_by: { id: 3, name: "Boris" },
    previous_shift: { id: 1, opened_at: "2026-11-17T10:00:00+04:00", closed_at: "2026-11-17T12:00:00+04:00", opened_by: { id: 2, name: "Anna" }, closed_by: { id: 2, name: "Anna" } },
    blamed_user: { id: 2, name: "Anna" }, window: null, gap: null,
    rows: [
      { product_id: 1, name: "Cola", unit_price: "500.00", expected: 9, counted: 8, diff: -1, value: "500.00", outcome: "shortage", is_baseline: false, last_movement_at: null, last_sale_at: null, flow: null },
      { product_id: 2, name: "Chips", unit_price: "300.00", expected: 5, counted: 5, diff: 0, value: "0.00", outcome: "none", is_baseline: false, last_movement_at: null, last_sale_at: null, flow: null },
    ],
    totals: { products: 2, baseline_products: 0, shortage_products: 1, shortage_units: 1, shortage_value: "500.00", surplus_products: 0, surplus_units: 0, surplus_value: "0.00" },
  };
  const handover: IStockHandover = { ...count, accepted_by_shift: { id: 2, opened_at: "2026-11-18T10:00:00+04:00", opened_by: { id: 3, name: "Boris" } } };
  const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((c) => c.textContent);

  test("on the shift that handed over: what the next shift counted, the minus in red, the reason", () => {
    render(<ShiftStockTable stock={ANNA} handover={handover} />);
    const [cola, chips] = screen.getAllByTestId("shift-stock-row");
    // «было → стало» in «Осталось», no extra column.
    expect(cells(cola)).toEqual(["10", "0", "1", "0", "0", "9 → 8 (−1)"]);
    expect(cola.className).toBe("is-short");
    expect(within(cola).getByTestId("shift-stock-remaining").className).toBe("is-negative");
    expect(cells(chips)).toEqual(["5", "0", "0", "0", "0", "5"]);
    expect(within(chips).queryByTestId("shift-stock-next")).toBeNull();
    expect(chips.className).toBe("");
    expect(screen.getByTestId("shift-stock-handover-total").textContent).toBe("⚠ shift.stock.lostTotal 1|500.00 AMD|{2}|{3}|{4}");
    expect(screen.getByTestId("shift-stock-handover-by").textContent).toContain("Boris");
    expect(screen.getAllByTestId("shift-stock-lost-reason").map((li) => li.textContent)).toEqual(["shift.handover.reason Cola|1|500.00 AMD|9|8"]);
  });

  test("on the shift that accepted: its «Пересчёт» is named as the previous shift's shortage", () => {
    const BORIS: IShiftStock = { ...ANNA, rows: [{ ...ANNA.rows[0], start: 9, sold: 0, sold_net: 0, corrected: -1, remaining: 8 }] };
    render(<ShiftStockTable stock={BORIS} acceptance={count} />);
    expect(screen.queryByTestId("shift-stock-next")).toBeNull();
    expect(screen.queryByTestId("shift-stock-handover")).toBeNull();
    expect(screen.getAllByTestId("shift-stock-accepted-row").map((li) => li.textContent)).toEqual(["shift.stock.acceptedShort Cola|−1|1|500.00 AMD|Anna"]);
  });

  test("nothing new when all matched, nothing handed over yet, or a manager's blind count", () => {
    const clean: IStockHandover = { ...handover, rows: handover.rows.map((r) => ({ ...r, diff: 0, value: "0.00", outcome: "none" as const })) };
    const blind: IAcceptanceCountBlind = { blind: true, counted_at: null, counted_by: null, rows: [{ product_id: 1, name: "Cola", counted: 8 }], count: 1 };
    const { rerender } = render(<ShiftStockTable stock={ANNA} handover={clean} />);
    expect(screen.queryByTestId("shift-stock-handover")).toBeNull();
    expect(cells(screen.getAllByTestId("shift-stock-row")[0])).toEqual(["10", "0", "1", "0", "0", "9"]);
    rerender(<ShiftStockTable stock={ANNA} handover={null} acceptance={blind} />);
    expect(screen.queryByTestId("shift-stock-next")).toBeNull();
    expect(screen.queryByTestId("shift-stock-accepted")).toBeNull();
    expect(cells(screen.getAllByTestId("shift-stock-row")[0])).toEqual(["10", "0", "1", "0", "0", "9"]);
  });
});
