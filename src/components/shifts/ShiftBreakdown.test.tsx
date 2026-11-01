// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { IShift, IShiftReport, IShiftStaffPart } from "@/types/shifts";

/**
 * The v3 blocks on screen (2026-10-26): products per product and price, each
 * person's part with the one closing first, the places handed over, sales of
 * earlier shifts voided here, and what the system does not record.
 */
vi.mock("@/i18n/LanguageContext", () => ({
  // Every key carries its placeholders, so the figures the server sent are
  // visibly the ones that reach the screen.
  useLang: () => ({ t: (k: string) => `${k}|{0}|{1}`, lang: "en", money: (n: number) => n.toFixed(2) }),
}));
import ShiftReportView from "./ShiftReportView";
import { staffInOrder } from "./ShiftBreakdown";

afterEach(() => cleanup());

const shift = { id: 1, branch_id: 1, status: "open", opened_at: "2026-10-26T10:00:00+04:00", closed_at: null,
  opened_by: { id: 1, name: "Anna" }, closed_by: null, opening_cash: "0.00", expected_cash: null,
  counted_cash: null, cash_difference: null, difference_kind: null, notes: null, has_report: false, branch: null, revenue_total: null } as IShift;

const person = (id: number, name: string): IShiftStaffPart => ({
  id, name,
  till: { count: 2, units: 3, total: "1700.00" },
  started: { launches: 3, seats: 2, finished: 2, running: 1 },
  started_billed: { count: 2, total: "2000.00" },
  closed: { count: 1, total: "1000.00", cash: "1000.00" },
  voided: { count: 0, total: "0.00" },
});

const v2: IShiftReport = {
  version: 2,
  period: { opened_at: "2026-10-26T10:00:00+04:00", to: "2026-10-26T14:00:00+04:00", duration_seconds: 14400 },
  places: { closed_count: 0, free_count: 0, expired_count: 0, started_count: 0, running_count: 0,
    by_method: { cash: "0.00", card: "0.00", other: "0.00", unrecorded: "0.00" },
    count_by_method: { cash: 0, card: 0, other: 0, unrecorded: 0 }, total: "0.00" },
  till: { paid_count: 0, by_method: { cash: "0.00", card: "0.00", deposit: "0.00", other: "0.00" },
    count_by_method: { cash: 0, card: 0, deposit: 0, other: 0 }, total: "0.00", voided_count: 0, voided_total: "0.00" },
  tournaments: { count: 0, total: "0.00" }, revenue_total: "0.00",
  by_method: { cash: "0.00", card: "0.00", other: "0.00", deposit: "0.00", unrecorded: "0.00" },
  cash: { opening: "0.00", places: "0.00", till: "0.00", expected: "0.00" },
  member_topups: { count: 0, total: "0.00" }, warnings: [],
};

const empty = { rows: [], units: 0, total: "0.00" };
const v3: IShiftReport = {
  ...v2,
  version: 3,
  products: {
    till: { rows: [
      { product_id: 1, name: "Coca-Cola", unit_price: "500.00", quantity: 5, total: "2500.00" },
      { product_id: 1, name: "Coca-Cola", unit_price: "550.00", quantity: 1, total: "550.00" },
    ], units: 6, total: "3050.00" },
    till_voided: { rows: [{ product_id: 2, name: "Lays", unit_price: "700.00", quantity: 5, total: "3500.00" }], units: 5, total: "3500.00" },
    places: { rows: [{ product_id: 3, name: "Water", unit_price: "300.00", quantity: 2, total: "600.00" }], units: 2, total: "600.00" },
    places_free: empty,
    units: 8,
    total: "3650.00",
  },
  staff: [person(1, "Anna"), person(2, "Boris")],
  handover: { count: 2, places: [
    { session_id: 9, seat: "№1", platform: "ps5", mode: "open", is_free: false, paused: false,
      started_at: "2026-10-26T11:00:00+04:00", ends_at: null, started_by: { id: 1, name: "Anna" } },
    { session_id: 10, seat: "№2", platform: "pc", mode: "fixed", is_free: false, paused: true,
      started_at: "2026-10-26T12:00:00+04:00", ends_at: "2026-10-26T15:30:00+04:00", started_by: { id: 2, name: "Boris" } },
  ] },
  voided_from_other_shifts: { count: 1, total: "1000.00", lines: [
    { id: 4, amount: "1000.00", method: "cash", shift_id: 7, sold_at: "2026-10-25T20:00:00+04:00", voided_at: "2026-10-26T13:00:00+04:00", voided_by_id: 2 },
  ] },
  not_tracked: ["customer_debts", "cash_movements", "topup_payment_method"],
  warnings: [],
};

describe("products", () => {
  test("each product at each price is its own line, with count × price and the totals", () => {
    render(<ShiftReportView shift={shift} report={v3} viewerId={1} />);
    const till = screen.getByTestId("shift-products-till");
    expect(till.textContent).toContain("Coca-Cola");
    expect(till.textContent).toContain("shift.productQty|5|500.00");
    expect(till.textContent).toContain("shift.productQty|1|550.00");
    expect(till.textContent).toContain("3050.00");
    expect(screen.getByTestId("shift-products-places").textContent).toContain("Water");
    const total = screen.getByTestId("shift-products-total");
    expect(total.textContent).toContain("3650.00");
    expect(total.textContent).toContain("shift.productsUnits|8|");
  });

  test("voided lines are shown apart and never in the products total", () => {
    render(<ShiftReportView shift={shift} report={v3} viewerId={1} />);
    expect(screen.getByTestId("shift-products-voided").textContent).toContain("Lays");
    expect(screen.getByTestId("shift-products-till").textContent).not.toContain("Lays");
    expect(screen.queryByTestId("shift-products-free")).toBeNull();
  });
});

describe("staff", () => {
  test("the person closing comes first and is named as such", () => {
    render(<ShiftReportView shift={shift} report={v3} viewerId={2} />);
    const people = screen.getAllByTestId("shift-staff-person");
    expect(people[0].textContent).toContain("Boris");
    expect(people[0].textContent).toContain("shift.staffCloser");
    expect(people[1].textContent).not.toContain("shift.staffCloser");
  });

  test("launches and distinct seats are two figures", () => {
    render(<ShiftReportView shift={shift} report={v3} viewerId={1} />);
    const started = within(screen.getAllByTestId("shift-staff-person")[0]).getByTestId("shift-staff-started");
    expect(started.textContent).toContain("shift.staffStartedValue|3|2");
    expect(started.textContent).toContain("shift.staffStartedHint|2|1");
  });

  test("a closed shift puts the one who closed it first, whoever is looking", () => {
    const closed = { ...shift, status: "closed", closed_by: { id: 2, name: "Boris" } } as IShift;
    render(<ShiftReportView shift={closed} report={{ ...v3, closed: { closed_at: "2026-10-26T14:00:00+04:00", closed_by: { id: 2, name: "Boris" }, notes: null } }} viewerId={1} />);
    expect(screen.getAllByTestId("shift-staff-person")[0].textContent).toContain("Boris");
  });
});

describe("handover and the rest", () => {
  test("running places say since when, who started them and until when", () => {
    render(<ShiftReportView shift={shift} report={v3} viewerId={1} />);
    const [open, planned] = screen.getAllByTestId("shift-handover-place");
    expect(open.textContent).toContain("№1");
    expect(open.textContent).toContain("Anna");
    expect(open.textContent).toContain("shift.handoverNoEnd");
    expect(planned.textContent).toContain("shift.handoverPaused");
    expect(planned.textContent).toContain("shift.handoverUntil|");
  });

  test("a sale of an earlier shift voided here is listed with who voided it", () => {
    render(<ShiftReportView shift={shift} report={v3} viewerId={1} />);
    const block = screen.getByTestId("shift-voided-elsewhere");
    expect(block.textContent).toContain("Boris");
    expect(block.textContent).toContain("1000.00");
  });

  test("what is not recorded is said, never shown as zero", () => {
    render(<ShiftReportView shift={shift} report={v3} viewerId={1} />);
    const block = screen.getByTestId("shift-not-tracked");
    expect(block.textContent).toContain("shift.notTracked.customer_debts");
    expect(block.textContent).toContain("shift.notTracked.cash_movements");
    expect(block.textContent).toContain("shift.notTracked.topup_payment_method");
  });

  test("a v2 report frozen before these blocks opens without them", () => {
    render(<ShiftReportView shift={shift} report={v2} viewerId={1} />);
    for (const id of ["shift-products", "shift-staff", "shift-handover", "shift-voided-elsewhere", "shift-not-tracked"]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });
});

describe("staffInOrder", () => {
  test("moves the closer first and keeps the server's order otherwise", () => {
    const list = [person(1, "A"), person(2, "B"), person(3, "C")];
    expect(staffInOrder(list, 3).map((p) => p.id)).toEqual([3, 1, 2]);
    expect(staffInOrder(list, null).map((p) => p.id)).toEqual([1, 2, 3]);
  });
});
