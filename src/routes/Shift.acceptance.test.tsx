// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { IShift } from "@/types/shifts";

/**
 * «Приём смены» (2026-11-18): opening a shift at a branch that counts
 * products. The count is BLIND, Open waits for every product, the body is
 * exact and one press id serves every retry of the attempt; a 422 names the
 * products to count; a branch that counts nothing opens at once with [].
 */

const repo = vi.hoisted(() => ({
  current: vi.fn(), list: vi.fn(), summary: vi.fn(), open: vi.fn(), close: vi.fn(), staff: vi.fn(), acceptanceProducts: vi.fn(),
}));
vi.mock("@/repositories/ShiftRepository", () => ({ shiftRepository: repo }));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: { byId: async () => ({ id: 4, address: "Abovyan 1", city: "Yerevan" }), list: async () => [] },
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 7, name: "Anna", role: "manager" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "en", money: (n: number) => n.toFixed(2) }),
}));
const toasts = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("@/ui/notify", () => ({ notify: { success: toasts.success, error: vi.fn(), warning: vi.fn(), message: vi.fn(), subscribe: () => () => {} } }));

import Shift from "./Shift";

const opened: IShift = {
  id: 11, branch_id: 4, status: "open", opened_at: "2026-11-18T10:00:00+04:00", closed_at: null,
  opened_by: { id: 7, name: "Anna" }, closed_by: null, opening_cash: "0.00", expected_cash: null, counted_cash: null,
  cash_difference: null, difference_kind: null, notes: null, has_report: true, branch: null, revenue_total: null,
};

/**
 * The list as the server sends it, plus figures it must NEVER send. If a
 * future backend leaked one, the form still could not show it: it renders the
 * name and the category only.
 */
const PRODUCTS = [
  { product_id: 1, name: "Cola", category: "Drinks", is_active: true, expected: 917, stock: 917 },
  { product_id: 2, name: "Chips", category: null, is_active: false, expected: 523, stock: 523 },
];

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/branches/4/shift"]}>
        <Routes><Route path="/branches/:branchId/shift" element={<Shift />} /></Routes>
      </MemoryRouter>,
    );
  });
};
const pressOpen = async () => { await act(async () => { fireEvent.click(screen.getByTestId("shift-open")); }); };
const type = (name: string, value: string) => {
  const row = screen.getAllByTestId("shift-accept-row").find((r) => r.textContent?.includes(name))!;
  fireEvent.change(within(row).getByTestId("shift-accept-input"), { target: { value } });
};
const openButton = () => screen.getByTestId("shift-accept-open") as HTMLButtonElement;
const confirmOpen = async () => { await act(async () => { fireEvent.click(openButton()); }); };

beforeEach(() => {
  for (const f of Object.values(repo)) f.mockReset();
  toasts.success.mockReset();
  repo.current.mockResolvedValue({ shift: null, report: null });
  repo.list.mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });
  repo.staff.mockResolvedValue([]);
  repo.acceptanceProducts.mockResolvedValue(PRODUCTS);
});
afterEach(() => cleanup());

describe("the count step", () => {
  test("is blind: names and the hint only, never a figure of the books", async () => {
    await mount();
    await pressOpen();
    const step = screen.getByTestId("shift-accept");
    expect(step.textContent).toContain("shift.accept.title");
    expect(step.textContent).toContain("shift.accept.hint");
    expect(step.textContent).toContain("Cola");
    expect(step.textContent).toContain("product.exists.hidden");
    expect(step.textContent).not.toContain("917");
    expect(step.textContent).not.toContain("523");
    for (const input of screen.getAllByTestId("shift-accept-input")) {
      expect((input as HTMLInputElement).value).toBe("");
      expect(input.getAttribute("type")).toBe("text");
    }
    expect(repo.open).not.toHaveBeenCalled();
  });

  test("Open stays off until every product has a number; 0 is a number", async () => {
    await mount();
    await pressOpen();
    expect(openButton().disabled).toBe(true);
    type("Cola", "4");
    expect(openButton().disabled).toBe(true);
    type("Chips", "abc");
    expect(openButton().disabled).toBe(true);
    type("Chips", "0");
    expect(openButton().disabled).toBe(false);
    type("Cola", "");
    expect(openButton().disabled).toBe(true);
  });

  test("sends the exact body once, then toasts «Смена открыта, товары приняты»", async () => {
    repo.open.mockResolvedValue({ shift: opened, acceptance_count: { blind: true, rows: [], count: 2 } });
    await mount();
    await pressOpen();
    type("Cola", "4");
    type("Chips", "0");
    await act(async () => { fireEvent.click(openButton()); fireEvent.click(openButton()); });

    expect(repo.open).toHaveBeenCalledTimes(1);
    expect(repo.open).toHaveBeenCalledWith({
      branch_id: 4,
      opening_cash: "0.00",
      client_request_id: expect.any(String),
      stock_counts: [{ product_id: 1, counted: 4 }, { product_id: 2, counted: 0 }],
    });
    expect(screen.queryByTestId("shift-accept")).toBeNull();
    expect(toasts.success).toHaveBeenCalledWith("shift", "accepted");
  });

  test("a retry after a failure sends the SAME press id", async () => {
    repo.open
      .mockRejectedValueOnce(Object.assign(new Error("Server error"), { status: 500 }))
      .mockResolvedValueOnce({ shift: opened });
    await mount();
    await pressOpen();
    type("Cola", "4");
    type("Chips", "1");
    await confirmOpen();
    expect(screen.getByTestId("shift-accept-error").textContent).toContain("Server error");
    await confirmOpen();

    expect(repo.open).toHaveBeenCalledTimes(2);
    const [first, second] = repo.open.mock.calls.map((c) => c[0].client_request_id as string);
    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(toasts.success).toHaveBeenCalledTimes(1);
  });

  test("after a shift opened, the next attempt has a new press id", async () => {
    repo.open.mockResolvedValue({ shift: opened });
    await mount();
    await pressOpen();
    type("Cola", "4");
    type("Chips", "1");
    await confirmOpen();
    // Back to no shift (closed elsewhere): a new attempt, counted afresh.
    await pressOpen();
    expect((screen.getAllByTestId("shift-accept-input")[0] as HTMLInputElement).value).toBe("");
    type("Cola", "4");
    type("Chips", "1");
    await confirmOpen();
    const ids = repo.open.mock.calls.map((c) => c[0].client_request_id as string);
    expect(ids).toHaveLength(2);
    expect(ids[1]).not.toBe(ids[0]);
  });

  test("422 stock_count_required: the missed products are outlined, a new one is added, the retry keeps the id", async () => {
    repo.open
      .mockRejectedValueOnce(Object.assign(new Error("count"), {
        status: 422,
        body: { code: "stock_count_required", message: "Count every product", missing: [{ product_id: 9, name: "Water" }] },
      }))
      .mockResolvedValueOnce({ shift: opened });
    await mount();
    await pressOpen();
    type("Cola", "4");
    type("Chips", "1");
    await confirmOpen();

    const rows = screen.getAllByTestId("shift-accept-row");
    const water = rows.find((r) => r.textContent?.includes("Water"))!;
    expect(water.className).toContain("is-missing");
    expect(rows.find((r) => r.textContent?.includes("Cola"))!.className).not.toContain("is-missing");
    expect(screen.getByTestId("shift-accept-error").textContent).toBe("shift.accept.missing");
    expect(openButton().disabled).toBe(true);

    type("Water", "6");
    expect(water.className).not.toContain("is-missing");
    await confirmOpen();
    const [first, second] = repo.open.mock.calls.map((c) => c[0]);
    expect(second.stock_counts).toEqual([{ product_id: 1, counted: 4 }, { product_id: 2, counted: 1 }, { product_id: 9, counted: 6 }]);
    expect(second.client_request_id).toBe(first.client_request_id);
  });

  test("a search narrows the list; hidden rows keep their numbers", async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ product_id: i + 1, name: `Item ${i + 1}`, category: i === 0 ? "Fridge" : null, is_active: true }));
    repo.acceptanceProducts.mockResolvedValue(many);
    await mount();
    await pressOpen();
    for (const r of screen.getAllByTestId("shift-accept-input")) fireEvent.change(r, { target: { value: "1" } });
    fireEvent.change(screen.getByTestId("shift-accept-search"), { target: { value: "fridge" } });
    expect(screen.getAllByTestId("shift-accept-row")).toHaveLength(1);
    expect(openButton().disabled).toBe(false);
  });

  test("somebody opened it meanwhile (409): the step closes, said as a notice", async () => {
    repo.open.mockRejectedValue(Object.assign(new Error("conflict"), { status: 409 }));
    await mount();
    await pressOpen();
    type("Cola", "4");
    type("Chips", "1");
    await confirmOpen();
    expect(screen.queryByTestId("shift-accept")).toBeNull();
    expect(screen.getByText("shift.alreadyOpen")).toBeTruthy();
  });
});

describe("a branch that counts nothing", () => {
  test("opens at once, still sending stock_counts: [] and a press id; no step, no toast", async () => {
    repo.acceptanceProducts.mockResolvedValue([]);
    repo.open.mockResolvedValue({ shift: opened });
    await mount();
    await pressOpen();
    expect(screen.queryByTestId("shift-accept")).toBeNull();
    expect(repo.open).toHaveBeenCalledWith({ branch_id: 4, opening_cash: "0.00", client_request_id: expect.any(String), stock_counts: [] });
    expect(toasts.success).not.toHaveBeenCalled();
  });
});
