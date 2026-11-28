// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { IAcceptanceCountBlind, IAcceptanceCountFull, IShift, IShiftReport, IStockHandover } from "@/types/shifts";

/**
 * «Приём смены» in the report (2026-11-18): the owner reads the books, the
 * flow behind them and the money; a manager reads only what was counted. The
 * figures are the backend's own `ShiftAcceptanceCountTest` evening (Cola: 10
 * accepted, 1 sold, 9 expected, 7 counted = −2, 1 000).
 */
// Sentences keep their placeholders, so the values really reach the screen.
const SENTENCES = /\.(lastSale|countedBy|previous|gap|blamed|totalShortage|totalSurplus)$/;
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    t: (k: string) => (k === "shift.handover.reason" ? `${k} {0}|{1}|{2}|{3}|{4}` : SENTENCES.test(k) || k === "shift.handover.acceptedBy" ? `${k} {0} {1}` : k),
    lang: "en", money: (n: number) => `${n.toFixed(2)} AMD`,
  }),
}));
import ShiftAcceptanceBlock from "./ShiftAcceptanceBlock";
import ShiftReportView from "../ShiftReportView";

afterEach(() => cleanup());

const full: IAcceptanceCountFull = {
  counted_at: "2026-11-18T12:30:00+04:00",
  counted_by: { id: 3, name: "Boris" },
  previous_shift: { id: 1, opened_at: "2026-11-17T10:00:00+04:00", closed_at: "2026-11-17T12:00:00+04:00", opened_by: { id: 2, name: "Anna" }, closed_by: { id: 2, name: "Anna" } },
  blamed_user: { id: 2, name: "Anna" },
  window: { from: "2026-11-17T10:00:00+04:00", to: "2026-11-17T12:00:00+04:00" },
  gap: { from: "2026-11-17T12:00:00+04:00", to: "2026-11-18T12:30:00+04:00", seconds: 88200, notable: true },
  rows: [
    { product_id: 1, name: "Cola", unit_price: "500.00", expected: 9, counted: 7, diff: -2, value: "1000.00", outcome: "shortage", is_baseline: false,
      last_movement_at: "2026-11-17T11:40:00+04:00", last_sale_at: "2026-11-17T11:40:00+04:00",
      flow: { accepted: 10, received: 0, sold: 1, returned: 0, corrected: 0 } },
    { product_id: 2, name: "Juice", unit_price: "300.00", expected: 5, counted: 6, diff: 1, value: "300.00", outcome: "surplus", is_baseline: false,
      last_movement_at: null, last_sale_at: null, flow: { accepted: 5, received: 0, sold: 0, returned: 0, corrected: 0 } },
    { product_id: 3, name: "Water", unit_price: "200.00", expected: 4, counted: 1, diff: -3, value: "600.00", outcome: "baseline", is_baseline: true,
      last_movement_at: null, last_sale_at: null, flow: { accepted: null, received: 4, sold: 0, returned: 0, corrected: 0 } },
  ],
  totals: { products: 3, baseline_products: 1, shortage_products: 1, shortage_units: 2, shortage_value: "1000.00", surplus_products: 1, surplus_units: 1, surplus_value: "300.00" },
};

const blind: IAcceptanceCountBlind = {
  blind: true, counted_at: "2026-11-18T12:30:00+04:00", counted_by: { id: 3, name: "Boris" },
  rows: [{ product_id: 1, name: "Cola", counted: 7 }, { product_id: 2, name: "Juice", counted: 6 }], count: 2,
};

const cells = (name: string) => {
  const row = screen.getAllByTestId("shift-acceptance-row").find((r) => r.textContent?.includes(name))!;
  return Object.fromEntries(Array.from(row.querySelectorAll("td")).map((td) => [td.dataset.col, td.textContent]));
};

describe("owner / admin", () => {
  test("the flow, the books, the count, the difference and its money, as sent", () => {
    render(<ShiftAcceptanceBlock count={full} />);
    expect(Array.from(screen.getByTestId("shift-acceptance").querySelectorAll("thead th")).map((th) => th.textContent)).toEqual([
      "shift.acceptCount.product", "shift.acceptCount.accepted", "shift.acceptCount.received", "shift.acceptCount.sold",
      "shift.acceptCount.returned", "shift.acceptCount.expected", "shift.acceptCount.counted", "shift.acceptCount.diff", "shift.acceptCount.value",
    ]);
    expect(cells("Cola")).toEqual({ accepted: "10", received: "0", sold: "1", returned: "0", expected: "9", counted: "7", diff: "−2", value: "1000.00 AMD" });
    expect(cells("Juice")).toMatchObject({ diff: "+1", value: "300.00 AMD" });
    // A first count: no previous count, nothing claimed.
    expect(cells("Water")).toMatchObject({ accepted: "shift.acceptCount.noPreviousCount", expected: "4", counted: "1", diff: "-", value: "-" });
  });

  test("a shortage is red and named, with the last sale; a surplus named; a first count said so", () => {
    render(<ShiftAcceptanceBlock count={full} />);
    const rows = screen.getAllByTestId("shift-acceptance-row");
    expect(rows[0].className).toContain("is-shortage");
    expect(within(rows[0]).getByTestId("shift-acceptance-outcome").textContent).toContain("shift.acceptCount.outcome.shortage");
    expect(within(rows[0]).getByTestId("shift-acceptance-last-sale").textContent).toContain("17.11 11:40");
    expect(within(rows[1]).getByTestId("shift-acceptance-outcome").textContent).toBe("shift.acceptCount.outcome.surplus");
    expect(rows[1].className).not.toContain("is-shortage");
    expect(within(rows[2]).getByTestId("shift-acceptance-outcome").textContent).toBe("shift.acceptCount.outcome.baseline");
    expect(screen.getByTestId("shift-acceptance-total-shortage").textContent).toContain("1000.00 AMD");
    expect(screen.getByTestId("shift-acceptance-total-surplus").textContent).toContain("300.00 AMD");
  });

  test("who counted, the previous shift, the gap and whose shortage", () => {
    render(<ShiftAcceptanceBlock count={full} />);
    expect(screen.getByTestId("shift-acceptance-by").textContent).toBe("shift.acceptCount.countedBy Boris 18.11.2026 12:30");
    expect(screen.getByTestId("shift-acceptance-previous").textContent).toBe("shift.acceptCount.previous Anna 17.11 10:00–12:00");
    expect(screen.getByTestId("shift-acceptance-gap").textContent).toBe("shift.acceptCount.gap 17.11 12:00 18.11 12:30");
    expect(screen.getByTestId("shift-acceptance-blamed").textContent).toContain("Anna");
  });

  test("«Исправлено» only when some product has one", () => {
    const corrected = { ...full, rows: full.rows.map((r, i) => (i === 1 ? { ...r, flow: { ...r.flow!, corrected: -2 } } : r)) };
    render(<ShiftAcceptanceBlock count={corrected} />);
    expect(screen.getByTestId("shift-acceptance").textContent).toContain("shift.acceptCount.corrected");
    expect(cells("Juice").corrected).toBe("−2");
  });

  test("no gap note and no blame when there is nothing to say", () => {
    render(<ShiftAcceptanceBlock count={{ ...full, gap: { ...full.gap!, notable: false }, totals: { ...full.totals, shortage_products: 0, shortage_value: "0.00" } }} />);
    expect(screen.queryByTestId("shift-acceptance-gap")).toBeNull();
    expect(screen.queryByTestId("shift-acceptance-blamed")).toBeNull();
    expect(screen.queryByTestId("shift-acceptance-total-shortage")).toBeNull();
  });
});

describe("manager", () => {
  test("blind: only what was counted, no books, no difference, no money", () => {
    render(<ShiftAcceptanceBlock count={blind} />);
    const block = screen.getByTestId("shift-acceptance");
    const head = Array.from(block.querySelectorAll("thead th")).map((th) => th.textContent);
    expect(head).toEqual(["shift.acceptCount.product", "shift.acceptCount.counted"]);
    for (const word of ["expected", "diff", "value", "accepted", "sold", "outcome", "total"]) {
      expect(block.textContent).not.toContain(`shift.acceptCount.${word}`);
    }
    expect(block.textContent).not.toContain("AMD");
    expect(screen.getAllByTestId("shift-acceptance-row").map((r) => r.textContent)).toEqual(["Cola7", "Juice6"]);
  });
});

describe("in the report", () => {
  const shift = { id: 2, branch_id: 1, status: "open", opened_at: "2026-11-18T12:30:00+04:00", closed_at: null, opened_by: { id: 3, name: "Boris" },
    closed_by: null, opening_cash: "0.00", expected_cash: null, counted_cash: null, cash_difference: null, difference_kind: null, notes: null,
    has_report: true, branch: null, revenue_total: null } as IShift;
  const report = {
    period: { opened_at: "2026-11-18T12:30:00+04:00", to: "2026-11-18T13:00:00+04:00", duration_seconds: 1800 },
    places: { closed_count: 0, free_count: 0, expired_count: 0, started_count: 0, running_count: 0, by_method: { cash: "0.00", card: "0.00", other: "0.00", unrecorded: "0.00" }, count_by_method: { cash: 0, card: 0, other: 0, unrecorded: 0 }, total: "0.00" },
    till: { paid_count: 0, by_method: { cash: "0.00", card: "0.00", deposit: "0.00", other: "0.00" }, count_by_method: { cash: 0, card: 0, deposit: 0, other: 0 }, total: "0.00", voided_count: 0, voided_total: "0.00" },
    tournaments: { count: 0, total: "0.00" }, revenue_total: "0.00",
    by_method: { cash: "0.00", card: "0.00", other: "0.00", deposit: "0.00", unrecorded: "0.00" },
    cash: { opening: "0.00", places: "0.00", till: "0.00", expected: "0.00" }, member_topups: { count: 0, total: "0.00" }, warnings: [],
  } as IShiftReport;

  test("shown when the server sent a count, absent otherwise", () => {
    const { rerender } = render(<ShiftReportView shift={shift} report={report} />);
    expect(screen.queryByTestId("shift-acceptance")).toBeNull();
    rerender(<ShiftReportView shift={shift} report={{ ...report, acceptance_count: full }} />);
    expect(screen.getByTestId("shift-acceptance")).toBeTruthy();
  });

  test("the handover (2026-11-28) is shown inside «Остатки», never on a manager's open view", () => {
    const handover: IStockHandover = { ...full, accepted_by_shift: { id: 3, opened_at: "2026-11-19T10:00:00+04:00", opened_by: { id: 2, name: "Anna" } } };
    const stock = { rows: [{ product_id: 1, name: "Cola", start: 10, received: 0, sold: 1, returned: 0, sold_net: 1, corrected: 0, remaining: 9 }],
      totals: { start: 10, received: 0, sold: 1, returned: 0, sold_net: 1, corrected: 0, remaining: 9 }, count: 1, negative_count: 0 };
    const closed = { ...shift, status: "closed" as const };
    const { rerender } = render(<ShiftReportView shift={closed} report={{ ...report, stock }} handover={handover} />);
    expect(within(screen.getByTestId("shift-stock")).getByTestId("shift-stock-handover")).toBeTruthy();
    rerender(<ShiftReportView shift={closed} report={{ ...report, stock }} handover={null} />);
    expect(screen.queryByTestId("shift-stock-handover")).toBeNull();
    rerender(<ShiftReportView shift={closed} report={{ ...report, stock }} handover={handover} acceptanceOnly />);
    expect(screen.queryByTestId("shift-stock-handover")).toBeNull();
  });
});

/**
 * «Сдача смены» (2026-11-28, owner): the shortage is shown on the shift it
 * happened on, and every shortage is said in one sentence — name, how many,
 * what it is worth, should-be and counted — with the server's figures only.
 */
describe("the reason in words", () => {
  test("one sentence per shortage, nothing for a surplus or a first count", () => {
    render(<ShiftAcceptanceBlock count={full} />);
    expect(screen.getAllByTestId("shift-stock-reason").map((li) => li.textContent)).toEqual(["shift.handover.reason Cola|2|1000.00 AMD|9|7"]);
  });

  test("everything matching says no reason at all", () => {
    const clean: IAcceptanceCountFull = { ...full, rows: full.rows.map((r) => ({ ...r, diff: 0, value: "0.00", outcome: "none" as const, is_baseline: false })) };
    render(<ShiftAcceptanceBlock count={clean} />);
    expect(screen.queryByTestId("shift-stock-reasons")).toBeNull();
  });

});
