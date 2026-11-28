// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IShift } from "@/types/shifts";

/**
 * The shift history's filters (2026-10-19): they narrow one server request
 * together, the staff list follows the branch, and any change starts again on
 * page 1. Nothing is filtered in the browser, so the assertions are about the
 * request sent and what is drawn from the answer.
 */

const repo = vi.hoisted(() => ({ list: vi.fn(), staff: vi.fn(), summary: vi.fn() }));
vi.mock("@/repositories/ShiftRepository", () => ({ shiftRepository: repo }));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: {
    list: async () => [
      { id: 1, address: "Abovyan 1", city: "Yerevan" },
      { id: 2, address: "Komitas 5", city: "Yerevan" },
    ],
  },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => (k.startsWith("shift.handover.list") ? `${k} {0} {1}` : k), lang: "en", money: (n: number) => n.toFixed(2) }),
}));

import ShiftHistory from "./ShiftHistory";

const STAFF: Record<number, Array<{ id: number; name: string; role: string }>> = {
  1: [{ id: 10, name: "Anna Hakobyan", role: "manager" }, { id: 30, name: "Aram Petrosyan", role: "company_owner" }],
  2: [{ id: 20, name: "Ivan Ivanov", role: "manager" }, { id: 30, name: "Aram Petrosyan", role: "company_owner" }],
};

const row = (over: Partial<IShift> = {}): IShift => ({
  id: 5, branch_id: 1, status: "closed", opened_at: "2026-10-18T10:00:00+04:00", closed_at: "2026-10-19T02:05:00+04:00",
  opened_by: { id: 10, name: "Anna Hakobyan" }, closed_by: { id: 10, name: "Anna Hakobyan" }, opening_cash: "0.00",
  expected_cash: "50000.00", counted_cash: "47000.00", cash_difference: "-3000.00", difference_kind: "shortage",
  notes: "x", has_report: true, branch: { id: 1, address: "Abovyan 1", city: "Yerevan" }, revenue_total: "61500.00",
  ...over,
});

const page = (rows: IShift[], lastPage = 1) => ({ data: rows, meta: { current_page: 1, last_page: lastPage, per_page: 20, total: rows.length * lastPage } });
const lastCall = () => repo.list.mock.calls[repo.list.mock.calls.length - 1][0];
const select = (id: string, value: string) => fireEvent.change(screen.getByTestId(id), { target: { value } });

beforeEach(() => {
  for (const f of Object.values(repo)) f.mockReset();
  repo.list.mockResolvedValue(page([row()]));
  repo.staff.mockImplementation(async (branchId: number) => STAFF[branchId] ?? []);
});
afterEach(() => cleanup());

const mount = async (props: { fixedBranchId?: number; canPickStaff: boolean }) => {
  await act(async () => { render(<ShiftHistory {...props} />); });
};

describe("the owner's filters", () => {
  test("branch, staff, dates, status and difference go out together, on page 1", async () => {
    await mount({ canPickStaff: true });
    await waitFor(() => expect(screen.getByText("Abovyan 1, Yerevan")).toBeTruthy());

    await act(async () => { select("shift-filter-branch", "1"); });
    await waitFor(() => expect(screen.getByText("Anna Hakobyan", { selector: "option" })).toBeTruthy());
    await act(async () => {
      select("shift-filter-staff", "10");
      fireEvent.change(screen.getByTestId("shift-filter-from"), { target: { value: "2026-10-01" } });
      fireEvent.change(screen.getByTestId("shift-filter-to"), { target: { value: "2026-10-19" } });
      select("shift-filter-status", "closed");
      select("shift-filter-discrepancy", "shortage");
    });

    await waitFor(() => expect(lastCall()).toEqual({
      branch_id: 1, staff_user_id: 10, date_from: "2026-10-01", date_to: "2026-10-19",
      status: "closed", discrepancy: "shortage", page: 1, per_page: 20,
    }));
  });

  test("the staff list is the picked branch's, and a pick from another branch is dropped", async () => {
    await mount({ canPickStaff: true });
    expect((screen.getByTestId("shift-filter-staff") as HTMLSelectElement).disabled).toBe(true);

    await act(async () => { select("shift-filter-branch", "1"); });
    await waitFor(() => expect(repo.staff).toHaveBeenCalledWith(1));
    await act(async () => { select("shift-filter-staff", "10"); });

    // Anna works at branch 1 only: switching to 2 drops her.
    await act(async () => { select("shift-filter-branch", "2"); });
    await waitFor(() => expect(repo.staff).toHaveBeenCalledWith(2));
    await waitFor(() => expect(lastCall().staff_user_id).toBeUndefined());
    expect(screen.queryByText("Anna Hakobyan", { selector: "option" })).toBeNull();
    expect(screen.getByText("Ivan Ivanov", { selector: "option" })).toBeTruthy();

    // The owner works at both: a pick that belongs to the new branch stays.
    await act(async () => { select("shift-filter-staff", "30"); });
    await act(async () => { select("shift-filter-branch", "1"); });
    await waitFor(() => expect(lastCall()).toEqual(expect.objectContaining({ branch_id: 1, staff_user_id: 30 })));
  });

  test("a filter change goes back to page 1", async () => {
    repo.list.mockResolvedValue(page([row()], 3));
    await mount({ canPickStaff: true });
    await waitFor(() => expect(screen.getAllByRole("button").some((b) => b.textContent?.trim() === "2")).toBe(true));
    const next = screen.getAllByRole("button").find((b) => b.textContent?.trim() === "2");
    expect(next).toBeTruthy();
    await act(async () => { fireEvent.click(next!); });
    await waitFor(() => expect(lastCall().page).toBe(2));

    await act(async () => { select("shift-filter-status", "open"); });
    await waitFor(() => expect(lastCall()).toEqual(expect.objectContaining({ status: "open", page: 1 })));
  });

  test("each active filter shows as a chip in words, and removing one keeps the others", async () => {
    await mount({ canPickStaff: true });
    await waitFor(() => expect(screen.getByText("Abovyan 1, Yerevan")).toBeTruthy());
    expect(screen.queryByTestId("shift-filter-chips")).toBeNull();
    await act(async () => {
      select("shift-filter-branch", "1");
      fireEvent.change(screen.getByTestId("shift-filter-from"), { target: { value: "2026-10-01" } });
      select("shift-filter-discrepancy", "shortage");
    });
    const chips = screen.getByTestId("shift-filter-chips");
    expect(chips.textContent).toContain("Abovyan 1, Yerevan");
    expect(chips.textContent).toContain("01.10.2026");
    expect(chips.textContent).toContain("shift.kind.shortage");

    const fromChip = Array.from(chips.querySelectorAll("button")).find((b) => b.textContent?.includes("01.10.2026"))!;
    await act(async () => { fireEvent.click(fromChip); });
    await waitFor(() => expect(lastCall()).toEqual({ branch_id: 1, discrepancy: "shortage", page: 1, per_page: 20 }));
  });

  test("reset clears every filter and says how many were on", async () => {
    await mount({ canPickStaff: true });
    await act(async () => {
      select("shift-filter-status", "closed");
      select("shift-filter-discrepancy", "any");
    });
    const reset = await screen.findByTestId("shift-filter-reset");
    expect(reset.textContent).toContain("(2)");
    await act(async () => { fireEvent.click(reset); });
    await waitFor(() => expect(lastCall()).toEqual({ page: 1, per_page: 20 }));
    expect(screen.queryByTestId("shift-filter-reset")).toBeNull();
  });
});

describe("what is drawn", () => {
  test("a manager has no staff picker: their history is already theirs", async () => {
    await mount({ canPickStaff: false });
    expect(screen.queryByTestId("shift-filter-staff")).toBeNull();
    expect(repo.staff).not.toHaveBeenCalled();
  });

  test("the branch screen fixes the branch: no branch picker, every request carries it", async () => {
    await mount({ fixedBranchId: 2, canPickStaff: true });
    expect(screen.queryByTestId("shift-filter-branch")).toBeNull();
    await waitFor(() => expect(lastCall().branch_id).toBe(2));
  });

  test("a shortage is said in words, with the figures", async () => {
    await mount({ canPickStaff: true });
    const diff = await screen.findByTestId("shift-history-difference");
    expect(diff.textContent).toContain("shift.kind.shortage");
    expect(diff.textContent).toContain("-3000.00");
    expect(screen.getByTestId("shift-history-row").textContent).toContain("61500.00");
  });

  test("no match under filters says so, distinct from an empty history", async () => {
    repo.list.mockResolvedValue(page([]));
    await mount({ canPickStaff: true });
    await waitFor(() => expect(screen.getByText("shift.historyEmpty")).toBeTruthy());
    await act(async () => { select("shift-filter-status", "open"); });
    await waitFor(() => expect(screen.getByText("shift.filter.noMatch")).toBeTruthy());
  });

  test("a failed read is an error, not an empty history", async () => {
    repo.list.mockRejectedValue(new Error("offline"));
    await mount({ canPickStaff: true });
    await waitFor(() => expect(screen.getByText("shift.state.errorTitle")).toBeTruthy());
    expect(screen.queryByText("shift.historyEmpty")).toBeNull();
  });

  test("goods short at handover are named on the shift they went missing on (2026-11-28)", async () => {
    repo.list.mockResolvedValue(page([
      row({ id: 5, stock_handover: { products: 3, units: 4, value: "1700.00", items_total: 3,
        items: [{ name: "Energy", diff: -1, value: "900.00" }, { name: "Water", diff: -2, value: "400.00" }] } }),
      row({ id: 6, stock_handover: null }),
      row({ id: 7 }),
    ]));
    await mount({ canPickStaff: true });
    const lines = await screen.findAllByTestId("shift-history-stock");
    expect(lines.map((l) => l.textContent)).toEqual(["⚠ shift.handover.listShortage 4 1700.00: Energy −1, Water −2 shift.handover.listMore 1 {1}"]);
  });

  test("the shortage shows in «Остатки» of the shift that handed it over", async () => {
    const block = { counted_at: "2026-10-19T10:00:00+04:00", counted_by: { id: 20, name: "Ivan" }, previous_shift: null, blamed_user: { id: 10, name: "Anna" },
      window: null, gap: null, accepted_by_shift: { id: 6, opened_at: "2026-10-19T10:00:00+04:00", opened_by: { id: 20, name: "Ivan" } },
      rows: [{ product_id: 1, name: "Cola", unit_price: "500.00", expected: 9, counted: 8, diff: -1, value: "500.00", outcome: "shortage", is_baseline: false, last_movement_at: null, last_sale_at: null, flow: null }],
      totals: { products: 1, baseline_products: 0, shortage_products: 1, shortage_units: 1, shortage_value: "500.00", surplus_products: 0, surplus_units: 0, surplus_value: "0.00" } };
    const report = {
      period: { opened_at: "2026-10-18T10:00:00+04:00", to: "2026-10-19T02:05:00+04:00", duration_seconds: 1 },
      places: { closed_count: 0, free_count: 0, expired_count: 0, started_count: 0, running_count: 0, by_method: { cash: "0.00", card: "0.00", other: "0.00", unrecorded: "0.00" }, count_by_method: { cash: 0, card: 0, other: 0, unrecorded: 0 }, total: "0.00" },
      till: { paid_count: 0, by_method: { cash: "0.00", card: "0.00", deposit: "0.00", other: "0.00" }, count_by_method: { cash: 0, card: 0, deposit: 0, other: 0 }, total: "0.00", voided_count: 0, voided_total: "0.00" },
      tournaments: { count: 0, total: "0.00" }, revenue_total: "0.00",
      by_method: { cash: "0.00", card: "0.00", other: "0.00", deposit: "0.00", unrecorded: "0.00" },
      cash: { opening: "0.00", places: "0.00", till: "0.00", expected: "0.00" }, member_topups: { count: 0, total: "0.00" }, warnings: [],
      stock: { rows: [{ product_id: 1, name: "Cola", start: 10, received: 0, sold: 1, returned: 0, sold_net: 1, corrected: 0, remaining: 9 }],
        totals: { start: 10, received: 0, sold: 1, returned: 0, sold_net: 1, corrected: 0, remaining: 9 }, count: 1, negative_count: 0 },
    };
    repo.summary.mockResolvedValue({ shift: row(), report, stock_handover: block });
    await mount({ canPickStaff: true });
    await act(async () => { fireEvent.click(await screen.findByText("shift.report")); });
    expect(await screen.findByTestId("shift-stock-handover")).toBeTruthy();
  });

  test("a saved report opens from its row", async () => {
    repo.summary.mockResolvedValue({ shift: row(), report: null });
    await mount({ canPickStaff: true });
    await act(async () => { fireEvent.click(await screen.findByText("shift.report")); });
    expect(repo.summary).toHaveBeenCalledWith(5);
    await waitFor(() => expect(screen.getByTestId("shift-report-modal")).toBeTruthy());
    expect(screen.getByText("shift.noReport")).toBeTruthy();
  });
});
