// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import type { IShift, IShiftReport } from "@/types/shifts";
import { t as translate } from "@/i18n/translations";

/**
 * A v4 shift report (no prepayments), through the real dictionary. Recorded
 * BEFORE the v5 lines were added: a report frozen before them, and a v5 report
 * with nothing paid ahead, must read exactly as v4 did.
 */
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => translate(k, "en"), lang: "en", money: (n: number) => n.toFixed(2) }),
}));
import ShiftReportView from "./ShiftReportView";

beforeAll(() => { process.env.TZ = "Asia/Yerevan"; });
afterEach(() => cleanup());

const shift = { id: 1, branch_id: 1, status: "closed", opened_at: "2026-11-10T10:00:00+04:00", closed_at: "2026-11-11T02:00:00+04:00",
  opened_by: { id: 1, name: "Anna" }, closed_by: { id: 1, name: "Anna" }, opening_cash: "10000.00", expected_cash: "13500.00",
  counted_cash: "13500.00", cash_difference: "0.00", difference_kind: "none", notes: null, has_report: true, branch: null, revenue_total: "3500.00" } as IShift;

export const V4: IShiftReport = {
  version: 4,
  period: { opened_at: "2026-11-10T10:00:00+04:00", to: "2026-11-11T02:00:00+04:00", duration_seconds: 57600 },
  places: { closed_count: 2, free_count: 0, expired_count: 0, started_count: 2, running_count: 0, unique_seats: 2, paused_count: 0,
    by_method: { cash: "3500.00", card: "0.00", other: "0.00", unrecorded: "0.00" },
    count_by_method: { cash: 2, card: 0, other: 0, unrecorded: 0 }, total: "3500.00",
    by_platform: [{ platform: "ps5", count: 2, total: "3500.00" }] },
  till: { paid_count: 0, by_method: { cash: "0.00", card: "0.00", deposit: "0.00", other: "0.00" },
    count_by_method: { cash: 0, card: 0, deposit: 0, other: 0 }, total: "0.00", voided_count: 0, voided_total: "0.00" },
  tournaments: { count: 0, total: "0.00" }, revenue_total: "3500.00",
  by_method: { cash: "3500.00", card: "0.00", other: "0.00", deposit: "0.00", unrecorded: "0.00" },
  cash: { opening: "10000.00", places: "3500.00", till: "0.00", expected: "13500.00", counted: "13500.00", difference: "0.00", difference_kind: "none" },
  member_topups: { count: 0, total: "0.00" }, warnings: [],
  lines: {
    places: [
      { id: 7, seat: "№1 PS5", platform: "ps5", method: "cash", amount: "1500.00", status: "stopped", is_free: false, closed_at: "2026-11-10T12:00:00+04:00" },
      { id: 8, seat: "№2 PS5", platform: "ps5", method: "cash", amount: "2000.00", status: "stopped", is_free: false, closed_at: "2026-11-10T13:00:00+04:00" },
    ],
    till: [], tournaments: [], member_topups: [],
  },
  staff: [{ id: 1, name: "Anna", till: { count: 0, units: 0, total: "0.00" }, started: { launches: 2, seats: 2, finished: 2, running: 0 },
    started_billed: { count: 2, total: "3500.00" }, closed: { count: 2, total: "3500.00", cash: "3500.00" }, voided: { count: 0, total: "0.00" } }],
};

describe("an old shift report renders exactly as before (snapshot)", () => {
  test("v4", () => {
    render(<ShiftReportView shift={shift} report={V4} />);
    expect(screen.getByTestId("shift-report").textContent).toMatchSnapshot();
  });
});

/** Report v5 (2026-11-15): cash paid ahead, the change given back, what was left owing. */
describe("report v5", () => {
  const zeroes: IShiftReport = {
    ...V4, version: 5,
    cash: { ...V4.cash, prepaid_in: "0.00", prepaid_settled: "0.00", change: "0.00" },
    places: { ...V4.places, prepaid: { count: 0, amount: "0.00", settled: "0.00", change: "0.00", due: "0.00" }, unpaid: { count: 0, amount: "0.00" } },
    lines: { ...V4.lines!, prepaid: [], places: V4.lines!.places.map((l) => ({ ...l, prepaid: null, change: null, unpaid: null })) },
    staff: V4.staff!.map((p) => ({ ...p, started: { ...p.started, prepaid: "0.00" } })),
  };

  test("with nothing paid ahead it reads exactly as v4", () => {
    render(<ShiftReportView shift={shift} report={V4} />);
    const v4 = screen.getByTestId("shift-report").textContent;
    cleanup();
    render(<ShiftReportView shift={shift} report={zeroes} />);
    expect(screen.getByTestId("shift-report").textContent).toBe(v4);
  });

  const paidAhead: IShiftReport = {
    ...zeroes,
    cash: { ...zeroes.cash, prepaid_in: "5000.00", prepaid_settled: "2000.00", change: "500.00", expected: "16500.00" },
    places: { ...zeroes.places, prepaid: { count: 1, amount: "2000.00", settled: "2000.00", change: "500.00", due: "0.00" }, unpaid: { count: 1, amount: "1200.00" } },
    lines: { ...zeroes.lines!,
      places: [{ ...zeroes.lines!.places[0], prepaid: "2000.00", change: "500.00" }, { ...zeroes.lines!.places[1], unpaid: "1200.00" }],
      prepaid: [
        { id: 1, session_id: 7, seat: "№1 PS5", amount: "2000.00", method: "cash", kind: "start", user_id: 1, at: "2026-11-10T11:00:00+04:00" },
        { id: 2, session_id: 9, seat: "№3", amount: "3000.00", method: "cash", kind: "time", user_id: 1, at: "2026-11-10T15:00:00+04:00" },
      ] },
    staff: zeroes.staff!.map((p) => ({ ...p, started: { ...p.started, prepaid: "5000.00" } })),
  };

  test("the drawer: + paid ahead, − settled, and the change given back, the server's figures", () => {
    render(<ShiftReportView shift={shift} report={paidAhead} />);
    expect(screen.getByTestId("shift-cash-prepaid-in").textContent).toContain("+ Paid ahead in this shift");
    expect(screen.getByTestId("shift-cash-prepaid-in").textContent).toContain("5000.00");
    expect(screen.getByTestId("shift-cash-prepaid-settled").textContent).toContain("2000.00");
    expect(screen.getByTestId("shift-cash-change").textContent).toContain("500.00");
    expect(screen.getByTestId("shift-cash-expected").textContent).toContain("16500.00");
  });

  test("the lines: each prepayment, and a place's prepayment, change and unpaid", () => {
    render(<ShiftReportView shift={shift} report={paidAhead} />);
    const text = screen.getByTestId("shift-lines").textContent ?? "";
    expect(text).toContain("Paid ahead (cash, not revenue)");
    expect(text).toContain("№3 · + Time");
    expect(text).toContain("Paid ahead 2000.00 · Change 500.00");
    expect(text).toContain("Not paid at the end 1200.00");
  });

  test("a person's cash taken ahead", () => {
    render(<ShiftReportView shift={shift} report={paidAhead} />);
    expect(screen.getByTestId("shift-staff-prepaid").textContent).toContain("5000.00");
  });
});
