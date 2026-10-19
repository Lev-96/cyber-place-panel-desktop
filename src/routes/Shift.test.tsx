// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { IShift, IShiftReport } from "@/types/shifts";

/**
 * The shift screen (2026-10-19): what the person at the till sees and can do.
 * The repository is faked; the figures are the server's and the screen only
 * shows them, so the assertions are about what is drawn and what is sent.
 */

const repo = vi.hoisted(() => ({
  current: vi.fn(), list: vi.fn(), summary: vi.fn(), open: vi.fn(), close: vi.fn(),
}));
vi.mock("@/repositories/ShiftRepository", () => ({ shiftRepository: repo }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 7, name: "Anna Hakobyan", role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "en", money: (n: number) => n.toFixed(2) }),
}));

import Shift from "./Shift";

const shift = (over: Partial<IShift> = {}): IShift => ({
  id: 11, branch_id: 4, status: "open", opened_at: "2026-10-19T10:00:00+04:00", closed_at: null,
  opened_by: { id: 7, name: "Anna Hakobyan" }, closed_by: null, opening_cash: "50000.00",
  expected_cash: null, counted_cash: null, cash_difference: null, difference_kind: null, notes: null, has_report: true,
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
  repo.list.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe("no shift open", () => {
  beforeEach(() => repo.current.mockResolvedValue({ shift: null, report: null }));

  test("opens one with the counted opening cash, sent as an exact amount, once", async () => {
    repo.open.mockResolvedValue(shift());
    await mount();
    fireEvent.change(screen.getByTestId("shift-opening-cash"), { target: { value: "20 000,5" } });
    const button = screen.getByTestId("shift-open");
    await act(async () => { fireEvent.click(button); fireEvent.click(button); });

    expect(repo.open).toHaveBeenCalledTimes(1);
    expect(repo.open).toHaveBeenCalledWith(4, "20000.50");
    expect(repo.current).toHaveBeenCalledTimes(2); // re-read after opening
  });

  test("an amount that is not one cannot be sent", async () => {
    await mount();
    fireEvent.change(screen.getByTestId("shift-opening-cash"), { target: { value: "12.345" } });
    expect((screen.getByTestId("shift-open") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("shift.countedInvalid")).toBeTruthy();
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

  test("a shortage is named, needs a reason, and is then sent once", async () => {
    let finish!: (v: unknown) => void;
    repo.close.mockImplementation(() => new Promise((r) => { finish = r; }));
    await openDialog();

    // 50 000 expected, 47 000 counted.
    fireEvent.change(screen.getByTestId("shift-counted"), { target: { value: "47000" } });
    const preview = screen.getByTestId("shift-difference-preview");
    expect(preview.textContent).toContain("shift.kind.shortage");
    expect(preview.textContent).toContain("-3000.00");
    const confirm = screen.getByTestId("shift-confirm-close") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); // no reason yet

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
  test("the live report shows the server's figures and warnings in words", async () => {
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
    repo.list.mockResolvedValue([
      shift({ id: 9, status: "closed", closed_at: "2026-10-19T02:05:00+04:00", closed_by: { id: 8, name: "Aram Petrosyan" }, expected_cash: "50000.00", counted_cash: "52000.00", cash_difference: "2000.00", difference_kind: "surplus" }),
    ]);
    repo.summary.mockResolvedValue({ shift: shift({ id: 9, status: "closed" }), report: report() });
    await mount();

    const history = screen.getByTestId("shift-history");
    expect(history.textContent).toContain("Aram Petrosyan");
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
