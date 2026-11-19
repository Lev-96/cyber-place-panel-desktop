// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import type { IAcceptanceCountBlind, IShift, IShiftReport } from "@/types/shifts";

/**
 * The shift screen (2026-10-19): what the person at the till sees and can do.
 * The repository is faked; the figures are the server's and the screen only
 * shows them, so the assertions are about what is drawn and what is sent.
 */

const repo = vi.hoisted(() => ({
  current: vi.fn(), list: vi.fn(), summary: vi.fn(), open: vi.fn(), close: vi.fn(), staff: vi.fn(), acceptanceProducts: vi.fn(),
}));
vi.mock("@/repositories/ShiftRepository", () => ({ shiftRepository: repo }));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: { byId: async () => ({ id: 4, address: "Abovyan 1", city: "Yerevan" }), list: async () => [] },
}));
const auth = vi.hoisted(() => ({ role: "manager" }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 7, name: "Anna Hakobyan", role: auth.role } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "en", money: (n: number) => n.toFixed(2) }),
}));

import Shift from "./Shift";

const shift = (over: Partial<IShift> = {}): IShift => ({
  id: 11, branch_id: 4, status: "open", opened_at: "2026-10-19T10:00:00+04:00", closed_at: null,
  opened_by: { id: 7, name: "Anna Hakobyan" }, closed_by: null, opening_cash: "50000.00",
  expected_cash: null, counted_cash: null, cash_difference: null, difference_kind: null, notes: null, has_report: true,
  branch: { id: 4, address: "Abovyan 1", city: "Yerevan" }, revenue_total: null,
  ...over,
});

const report = (over: Partial<IShiftReport> = {}): IShiftReport => ({
  period: { opened_at: "2026-10-19T10:00:00+04:00", to: "2026-10-20T02:05:00+04:00", duration_seconds: 57900 },
  places: {
    closed_count: 3, free_count: 1, expired_count: 0, started_count: 3, running_count: 0,
    by_method: { cash: "0.00", card: "0.00", other: "0.00", unrecorded: "0.00" },
    count_by_method: { cash: 0, card: 0, other: 0, unrecorded: 0 }, total: "0.00",
  },
  till: {
    paid_count: 0, by_method: { cash: "0.00", card: "0.00", deposit: "0.00", other: "0.00" },
    count_by_method: { cash: 0, card: 0, deposit: 0, other: 0 }, total: "0.00", voided_count: 0, voided_total: "0.00",
  },
  tournaments: { count: 0, total: "0.00" },
  revenue_total: "0.00",
  by_method: { cash: "0.00", card: "0.00", other: "0.00", deposit: "0.00", unrecorded: "0.00" },
  cash: { opening: "50000.00", places: "0.00", till: "0.00", expected: "50000.00" },
  member_topups: { count: 0, total: "0.00" },
  warnings: [],
  ...over,
});

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/branches/4/shift"]}>
        <Routes><Route path="/branches/:branchId/shift" element={<Shift />} /></Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => {
  for (const f of Object.values(repo)) f.mockReset();
  repo.list.mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });
  repo.staff.mockResolvedValue([]);
  // A branch that counts nothing: the shift opens at once (2026-11-18).
  repo.acceptanceProducts.mockResolvedValue([]);
  auth.role = "manager";
});
afterEach(() => cleanup());

describe("no shift open", () => {
  beforeEach(() => repo.current.mockResolvedValue({ shift: null, report: null }));

  test("opens one at once, with no opening cash asked (2026-11-18, owner), once", async () => {
    repo.open.mockResolvedValue({ shift: shift() });
    await mount();
    expect(screen.queryByTestId("shift-opening-cash")).toBeNull();
    const button = screen.getByTestId("shift-open");
    await act(async () => { fireEvent.click(button); fireEvent.click(button); });

    expect(repo.open).toHaveBeenCalledTimes(1);
    // 2026-11-18: one body, always with a press id and the (here empty) count.
    expect(repo.open).toHaveBeenCalledWith({
      branch_id: 4, opening_cash: "0.00", client_request_id: expect.any(String), stock_counts: [],
    });
    expect(repo.current).toHaveBeenCalledTimes(2); // re-read after opening
  });

  test("somebody else opened it a moment ago: shown, not an error", async () => {
    repo.open.mockRejectedValue(Object.assign(new Error("conflict"), { status: 409 }));
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("shift-open")); });
    expect(screen.getByText("shift.alreadyOpen")).toBeTruthy();
    expect(screen.queryByText("conflict")).toBeNull();
  });

  test("reading the screen never opens a shift", async () => {
    await mount();
    expect(repo.open).not.toHaveBeenCalled();
  });
});

describe("closing", () => {
  beforeEach(() => repo.current.mockResolvedValue({ shift: shift(), report: report() }));

  const openDialog = async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("shift-close")); });
  };

  test("a shortage is named; a reason is optional (2026-11-18) and, when written, sent once", async () => {
    let finish!: (v: unknown) => void;
    repo.close.mockImplementation(() => new Promise((r) => { finish = r; }));
    await openDialog();

    // 50 000 expected, 47 000 counted.
    fireEvent.change(screen.getByTestId("shift-counted"), { target: { value: "47000" } });
    const preview = screen.getByTestId("shift-difference-preview");
    expect(preview.textContent).toContain("shift.kind.shortage");
    expect(preview.textContent).toContain("-3000.00");
    const confirm = screen.getByTestId("shift-confirm-close") as HTMLButtonElement;
    expect(confirm.disabled).toBe(false); // no reason needed
    expect(screen.getByText("shift.reasonOptional")).toBeTruthy();

    fireEvent.change(screen.getByTestId("shift-notes"), { target: { value: "Change given twice" } });
    expect(confirm.disabled).toBe(false);

    await act(async () => { fireEvent.click(confirm); fireEvent.click(confirm); fireEvent.click(confirm); });
    expect(repo.close).toHaveBeenCalledTimes(1);
    expect(repo.close).toHaveBeenCalledWith(11, "47000.00", "Change given twice");

    const closedReport = report({ cash: { opening: "50000.00", places: "0.00", till: "0.00", expected: "50000.00", counted: "47000.00", difference: "-3000.00", difference_kind: "shortage" }, closed: { closed_at: "2026-10-20T02:05:00+04:00", closed_by: { id: 7, name: "Anna Hakobyan" }, notes: "Change given twice" } });
    await act(async () => { finish({ shift: shift({ status: "closed" }), report: closedReport, already_closed: false }); });

    const modal = await screen.findByTestId("shift-report-modal");
    expect(modal.textContent).toContain("shift.closedTitle");
    expect(modal.textContent).toContain("shift.kind.shortage");
    expect(modal.textContent).toContain("Change given twice");
  });

  test("an exact till needs no reason", async () => {
    repo.close.mockResolvedValue({ shift: shift({ status: "closed" }), report: report(), already_closed: false });
    await openDialog();
    fireEvent.change(screen.getByTestId("shift-counted"), { target: { value: "50000" } });
    expect(screen.getByTestId("shift-difference-preview").textContent).toContain("shift.kind.none");
    expect((screen.getByTestId("shift-confirm-close") as HTMLButtonElement).disabled).toBe(false);
  });

  test("the dialog shows who is closing and that the report is final", async () => {
    await openDialog();
    expect(screen.getByText("shift.closingAs")).toBeTruthy();
    expect(screen.getByText("shift.finalNote")).toBeTruthy();
  });

  test("a close the server already had is shown as such", async () => {
    repo.close.mockResolvedValue({ shift: shift({ status: "closed" }), report: report(), already_closed: true });
    await openDialog();
    fireEvent.change(screen.getByTestId("shift-counted"), { target: { value: "50000" } });
    await act(async () => { fireEvent.click(screen.getByTestId("shift-confirm-close")); });
    expect(await screen.findByText("shift.alreadyClosed")).toBeTruthy();
  });
});

describe("the report and the history", () => {
  // Changed 2026-11-19 (owner): the figures are the OWNER's view of an open
  // shift; a manager's open shift shows only «Приём смены» (see below).
  test("the live report shows the server's figures and warnings in words (owner)", async () => {
    auth.role = "company_owner";
    repo.current.mockResolvedValue({
      shift: shift(),
      report: report({ revenue_total: "12500.00", by_method: { cash: "8000.00", card: "4500.00", other: "0.00", deposit: "0.00", unrecorded: "0.00" }, warnings: ["places_running"], places: { ...report().places, running_count: 2 } }),
    });
    await mount();
    expect(screen.getByTestId("shift-revenue-total").textContent).toContain("12500.00");
    expect(screen.getByTestId("shift-method-cash").textContent).toContain("8000.00");
    expect(screen.getByTestId("shift-warnings").textContent).toContain("shift.warn.places_running");
  });

  test("history lists each shift's till result and opens its saved report", async () => {
    repo.current.mockResolvedValue({ shift: null, report: null });
    repo.list.mockResolvedValue({ data: [
      shift({ id: 9, status: "closed", closed_at: "2026-10-19T02:05:00+04:00", closed_by: { id: 8, name: "Aram Petrosyan" }, expected_cash: "50000.00", counted_cash: "52000.00", cash_difference: "2000.00", difference_kind: "surplus" }),
    ], meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 } });
    repo.summary.mockResolvedValue({ shift: shift({ id: 9, status: "closed" }), report: report() });
    await mount();

    const history = await screen.findByTestId("shift-history");
    await waitFor(() => expect(history.textContent).toContain("Aram Petrosyan"));
    // The branch screen asks for its own branch only.
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ branch_id: 4, page: 1 }));
    expect(history.textContent).toContain("shift.kind.surplus: 2000.00");
    await act(async () => { fireEvent.click(screen.getByText("shift.report")); });
    expect(repo.summary).toHaveBeenCalledWith(9);
    await waitFor(() => expect(screen.getByTestId("shift-report-modal")).toBeTruthy());
  });

  test("a failed read says so instead of showing no shift", async () => {
    repo.current.mockRejectedValue(new Error("offline"));
    await mount();
    expect(screen.queryByTestId("shift-none")).toBeNull();
    expect(screen.queryByTestId("shift-open")).toBeNull();
  });
});

/**
 * Hooks run in the same order on every render (2026-10-27): the minute
 * re-read used to be declared AFTER the "invalid id" early return, so the
 * screen moving from a bad address to a good one (a deep link fixed by hand,
 * back/forward) rendered more hooks than before and React tore the screen down.
 */
describe("the address changes under the screen", () => {
  test("from an invalid branch id to a real one, the screen renders instead of crashing", async () => {
    repo.current.mockResolvedValue({ shift: null, report: null });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let go: (to: string) => void = () => {};
    const Nav = () => { go = useNavigate(); return null; };
    await act(async () => {
      render(
        <MemoryRouter initialEntries={["/branches/abc/shift"]}>
          <Nav />
          <Routes><Route path="/branches/:branchId/shift" element={<Shift />} /></Routes>
        </MemoryRouter>,
      );
    });
    expect(screen.getByText("hub.invalidId")).toBeTruthy();

    await act(async () => { go("/branches/4/shift"); });
    await waitFor(() => expect(repo.current).toHaveBeenCalledWith(4));
    expect(screen.queryByText("hub.invalidId")).toBeNull();
    expect(errors.mock.calls.some((c) => String(c[0]).includes("Rendered more hooks"))).toBe(false);
    errors.mockRestore();
  });
});

/**
 * A manager's OPEN shift (2026-11-19, owner): only «Приём смены», what was
 * counted. Revenue, payments, cash, places, products, stock, staff, handover
 * and the not-tracked list are not shown; the owner and admin see it all.
 */
describe("a manager's open shift", () => {
  const blindCount: IAcceptanceCountBlind = {
    blind: true, counted_at: "2026-10-19T10:05:00+04:00", counted_by: { id: 7, name: "Anna Hakobyan" },
    rows: [{ product_id: 1, name: "Cola", counted: 12 }], count: 1,
  };
  const full = () => report({
    revenue_total: "12500.00",
    by_method: { cash: "8000.00", card: "4500.00", other: "0.00", deposit: "0.00", unrecorded: "0.00" },
    warnings: ["places_running"], places: { ...report().places, running_count: 2, unique_seats: 2 },
    lines: { places: [], till: [], tournaments: [], member_topups: [] },
    staff: [], handover: { count: 0, places: [] }, not_tracked: ["cash_movements"],
    acceptance_count: blindCount,
  });
  const HIDDEN = [
    "shift-revenue-total", "shift-method-cash", "shift-cash-expected", "shift-warnings", "shift-lines", "shift-seats",
    "shift-staff", "shift-handover", "shift-not-tracked",
  ];

  test("shows the header and what was counted, nothing else", async () => {
    repo.current.mockResolvedValue({ shift: shift(), report: full() });
    await mount();
    expect(screen.getByTestId("shift-header")).toBeTruthy();
    expect(screen.getByTestId("shift-report").textContent).toContain("Cola");
    for (const id of HIDDEN) expect(screen.queryByTestId(id), id).toBeNull();
    const text = screen.getByTestId("shift-report").textContent ?? "";
    expect(text).not.toContain("12500.00");
    expect(text).not.toContain("8000.00");
    expect(text).not.toContain("shift.byMethod");
    expect(text).not.toContain("shift.cash");
    // Closing stays where it was.
    expect(screen.getByTestId("shift-close")).toBeTruthy();
  });

  test("nothing was counted: says so in words", async () => {
    repo.current.mockResolvedValue({ shift: shift(), report: report({ revenue_total: "12500.00" }) });
    await mount();
    expect(screen.getByTestId("shift-acceptance-none").textContent).toBe("shift.acceptCount.none");
    expect(screen.queryByTestId("shift-revenue-total")).toBeNull();
  });

  test.each(["company_owner", "admin"])("%s still sees the whole report", async (role) => {
    auth.role = role;
    repo.current.mockResolvedValue({ shift: shift(), report: full() });
    await mount();
    expect(screen.getByTestId("shift-revenue-total").textContent).toContain("12500.00");
    expect(screen.getByTestId("shift-method-cash").textContent).toContain("8000.00");
    expect(screen.getByTestId("shift-cash-expected")).toBeTruthy();
    for (const id of ["shift-staff", "shift-handover", "shift-not-tracked", "shift-lines"]) expect(screen.getByTestId(id), id).toBeTruthy();
    expect(screen.queryByTestId("shift-acceptance-none")).toBeNull();
  });

  test("a manager opening a CLOSED shift from the history still gets its report as before", async () => {
    repo.current.mockResolvedValue({ shift: null, report: null });
    repo.list.mockResolvedValue({ data: [
      shift({ id: 9, status: "closed", closed_at: "2026-10-19T02:05:00+04:00", closed_by: { id: 8, name: "Aram Petrosyan" } }),
    ], meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 } });
    repo.summary.mockResolvedValue({ shift: shift({ id: 9, status: "closed" }), report: full() });
    await mount();
    const history = await screen.findByTestId("shift-history");
    await waitFor(() => expect(history.textContent).toContain("Aram Petrosyan"));
    await act(async () => { fireEvent.click(screen.getByText("shift.report")); });
    await waitFor(() => expect(screen.getByTestId("shift-revenue-total").textContent).toContain("12500.00"));
  });
});
