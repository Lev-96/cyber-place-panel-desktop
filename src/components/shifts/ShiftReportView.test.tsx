// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { IShift, IShiftReport } from "@/types/shifts";

/**
 * The report on screen (2026-10-19): the v2 blocks when the server sent them,
 * and a report frozen before them (v1) still readable without them.
 */
vi.mock("@/i18n/LanguageContext", () => ({
  // Count keys keep their placeholder, so the counts really reach the screen
  // and a count glued to an amount is visible to the assertions.
  useLang: () => ({ t: (k: string) => (k.endsWith("Counts") ? `${k} {0}` : k), lang: "en", money: (n: number) => n.toFixed(2) }),
}));
import ShiftReportView from "./ShiftReportView";

afterEach(() => cleanup());

const shift = { id: 1, branch_id: 1, status: "closed", opened_at: "2026-10-19T10:00:00+04:00", closed_at: "2026-10-20T02:00:00+04:00",
  opened_by: { id: 1, name: "Anna" }, closed_by: { id: 1, name: "Anna" }, opening_cash: "0.00", expected_cash: "0.00",
  counted_cash: "0.00", cash_difference: "0.00", difference_kind: "none", notes: null, has_report: true, branch: null, revenue_total: "3500.00" } as IShift;

const v1: IShiftReport = {
  period: { opened_at: "2026-10-19T10:00:00+04:00", to: "2026-10-20T02:00:00+04:00", duration_seconds: 57600 },
  places: { closed_count: 3, free_count: 0, expired_count: 0, started_count: 3, running_count: 0,
    by_method: { cash: "3500.00", card: "0.00", other: "0.00", unrecorded: "0.00" },
    count_by_method: { cash: 3, card: 0, other: 0, unrecorded: 0 }, total: "3500.00" },
  till: { paid_count: 0, by_method: { cash: "0.00", card: "0.00", deposit: "0.00", other: "0.00" },
    count_by_method: { cash: 0, card: 0, deposit: 0, other: 0 }, total: "0.00", voided_count: 0, voided_total: "0.00" },
  tournaments: { count: 0, total: "0.00" }, revenue_total: "3500.00",
  by_method: { cash: "3500.00", card: "0.00", other: "0.00", deposit: "0.00", unrecorded: "0.00" },
  cash: { opening: "0.00", places: "3500.00", till: "0.00", expected: "3500.00" },
  member_topups: { count: 0, total: "0.00" }, warnings: [],
};

const v2: IShiftReport = {
  ...v1,
  version: 2,
  places: { ...v1.places, unique_seats: 2, paused_count: 0,
    by_platform: [{ platform: "pc", count: 1, total: "1500.00" }, { platform: "ps5", count: 2, total: "2000.00" }] },
  bookings: { created_count: 4, cancelled_count: 2, no_show_count: 1, served_count: 1, scheduled: { count: 4, served: 1, cancelled: 2, open: 1 } },
  lines: {
    places: [{ id: 7, seat: "№1 PS5", platform: "ps5", method: "cash", amount: "1000.00", status: "stopped", is_free: false, closed_at: "2026-10-19T12:00:00+04:00" }],
    till: [], tournaments: [], member_topups: [],
  },
};

describe("the report on screen", () => {
  test("v2: seats, platforms, bookings and the lines behind the totals", () => {
    render(<ShiftReportView shift={shift} report={v2} />);
    expect(screen.getByTestId("shift-seats").textContent).toContain("shift.seatsUsedValue");
    expect(screen.getByText("PS5 · 2")).toBeTruthy();
    expect(screen.getByText("PC · 1")).toBeTruthy();
    expect(screen.getByTestId("shift-bookings-created").textContent).toContain("4");
    expect(screen.getByTestId("shift-lines").textContent).toContain("№1 PS5");
  });

  test("v1: a report frozen before the new blocks opens without them", () => {
    render(<ShiftReportView shift={shift} report={v1} />);
    expect(screen.getByTestId("shift-revenue-total").textContent).toContain("3500.00");
    expect(screen.queryByTestId("shift-seats")).toBeNull();
    expect(screen.queryByTestId("shift-bookings-created")).toBeNull();
    expect(screen.queryByTestId("shift-lines")).toBeNull();
  });
});

/**
 * The staging shift that read "Продажи на кассе 23 000" (2026-10-19): two sales
 * worth 3 000, the count "2" printed right before the amount. The count now
 * lives in its own element under the label; the amount element holds the
 * amount and nothing else.
 */
describe("figures never run together", () => {
  const live: IShift = { ...shift, status: "open", closed_at: null, closed_by: null, counted_cash: null, cash_difference: null, difference_kind: null };
  const twoSales: IShiftReport = {
    ...v1,
    places: { ...v1.places, closed_count: 0, total: "0.00", by_method: { cash: "0.00", card: "0.00", other: "0.00", unrecorded: "0.00" } },
    till: { ...v1.till, paid_count: 2, total: "3000.00", by_method: { cash: "600.00", card: "2400.00", deposit: "0.00", other: "0.00" } },
    revenue_total: "3000.00",
    by_method: { cash: "600.00", card: "2400.00", other: "0.00", deposit: "0.00", unrecorded: "0.00" },
    cash: { opening: "50000.00", places: "0.00", till: "600.00", expected: "50600.00" },
  };

  test("the till's count and amount are separate elements", () => {
    render(<ShiftReportView shift={live} report={twoSales} />);
    const till = screen.getByTestId("shift-revenue-till");
    const strong = till.querySelector("strong")!;
    expect(strong.textContent).toBe("3000.00");
    expect(till.textContent).toContain("shift.tillCounts 2");
    expect(till.textContent).not.toContain("23000");
    expect(screen.getByTestId("shift-revenue-total").querySelector("strong")!.textContent).toBe("3000.00");
    expect(screen.getByTestId("shift-cash-expected").textContent).toContain("50600.00");
  });

  test("an open shift's header names each fact above its value and says the figures are as of the last read", () => {
    render(<ShiftReportView shift={live} report={twoSales} />);
    expect(screen.getByTestId("shift-status").textContent).toBe("shift.headerOpen");
    expect(screen.getByText("shift.asOf")).toBeTruthy();
    expect(screen.queryByText("shift.closedBy")).toBeNull();
    expect(screen.getByTestId("shift-duration").textContent).toContain("16 time.hourShort 0 time.minShort");
  });
});
