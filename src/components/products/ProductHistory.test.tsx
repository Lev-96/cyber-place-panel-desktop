// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IProductEvent } from "@/types/productEvents";

/**
 * «История товаров» (2026-11-09): every filter narrows one server request, any
 * change starts again on page 1, the employee and product lists follow the
 * branch, and nothing is filtered in the browser — so the assertions are about
 * the request sent and what is drawn from the answer.
 */

const repo = vi.hoisted(() => ({ list: vi.fn(), actors: vi.fn() }));
vi.mock("@/repositories/ProductEventRepository", () => ({ productEventRepository: repo }));
const products = vi.hoisted(() => ({ listByBranch: vi.fn() }));
vi.mock("@/repositories/ProductRepository", () => ({ productRepository: products }));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: {
    list: async () => [
      { id: 3, address: "Abovyan 1", city: "Yerevan" },
      { id: 4, address: "Komitas 5", city: "Yerevan" },
    ],
  },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "en", money: (n: number) => `${n.toFixed(2)} AMD` }),
}));

import ProductHistory from "./ProductHistory";

const ACTORS: Record<number, Array<{ id: number; name: string; role: "manager" | "company_owner" }>> = {
  3: [{ id: 10, name: "Anna Hakobyan", role: "manager" }, { id: 30, name: "Aram Petrosyan", role: "company_owner" }],
  4: [{ id: 20, name: "Ivan Ivanov", role: "manager" }],
};
const PRODUCTS: Record<number, Array<{ id: number; branch_id: number; name: string; price: number; is_active: boolean }>> = {
  3: [{ id: 7, branch_id: 3, name: "Tea", price: 300, is_active: true }],
  4: [{ id: 8, branch_id: 4, name: "Cola", price: 500, is_active: true }],
};

const row = (over: Partial<IProductEvent> = {}): IProductEvent => ({
  id: 1, action: "price_changed", product_id: 7, product_name: "Tea", branch_id: 3, branch_name: "Abovyan 1",
  actor: { id: 10, name: "Anna Hakobyan", role: "manager" }, before: null, after: null,
  old_price: "300.00", new_price: "350.00", created_at: "2026-11-09T08:05:00Z", ...over,
});
const page = (rows: IProductEvent[], lastPage = 1) =>
  ({ data: rows, meta: { current_page: 1, last_page: lastPage, per_page: 20, total: rows.length * lastPage } });
const lastCall = () => repo.list.mock.calls[repo.list.mock.calls.length - 1][0];
const change = (id: string, value: string) => fireEvent.change(screen.getByTestId(id), { target: { value } });

beforeEach(() => {
  repo.list.mockReset();
  repo.actors.mockReset();
  products.listByBranch.mockReset();
  repo.list.mockResolvedValue(page([row()]));
  repo.actors.mockImplementation(async (b: number) => ACTORS[b] ?? []);
  products.listByBranch.mockImplementation(async (b: number) => PRODUCTS[b] ?? []);
});
afterEach(() => cleanup());

const mount = async () => {
  await act(async () => { render(<ProductHistory initialBranchId={3} />); });
};

describe("the request", () => {
  test("opens on the screen's branch, page 1, 20 a page", async () => {
    await mount();
    expect(repo.list).toHaveBeenCalledTimes(1);
    expect(lastCall()).toMatchObject({ branch_id: 3, page: 1, per_page: 20 });
    expect(lastCall().user_id).toBeUndefined();
    expect(lastCall().action).toBeUndefined();
  });

  test("employee, product, action and period go out together", async () => {
    await mount();
    await waitFor(() => expect(screen.getByText("Anna Hakobyan (role.manager)")).toBeTruthy());
    await waitFor(() => expect(screen.getByRole("option", { name: "Tea" })).toBeTruthy());

    await act(async () => { change("product-history-employee", "10"); });
    await act(async () => { change("product-history-product", "7"); });
    await act(async () => { change("product-history-action", "price_changed"); });
    await act(async () => { change("product-history-from", "2026-11-01"); });
    await act(async () => { change("product-history-to", "2026-11-09"); });

    expect(lastCall()).toEqual({
      branch_id: 3, user_id: 10, product_id: 7, action: "price_changed",
      from: "2026-11-01", to: "2026-11-09", page: 1, per_page: 20,
    });
    expect(screen.getByTestId("product-history-reset").textContent).toContain("(5)");
  });

  test("a later page is asked for, and a filter change goes back to page 1", async () => {
    repo.list.mockResolvedValue(page([row()], 3));
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "2" })); });
    expect(lastCall()).toMatchObject({ branch_id: 3, page: 2 });

    await act(async () => { change("product-history-action", "deleted"); });
    expect(lastCall()).toMatchObject({ action: "deleted", page: 1 });
  });

  test("all branches: no branch sent, the employee and product pickers wait for one", async () => {
    await mount();
    await act(async () => { change("product-history-branch", ""); });
    expect(lastCall().branch_id).toBeUndefined();
    expect((screen.getByTestId("product-history-employee") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByTestId("product-history-product") as HTMLSelectElement).disabled).toBe(true);
  });

  test("a pick that does not belong to the new branch is dropped", async () => {
    await mount();
    await waitFor(() => expect(screen.getByText("Anna Hakobyan (role.manager)")).toBeTruthy());
    await act(async () => { change("product-history-employee", "10"); });
    await act(async () => { change("product-history-branch", "4"); });
    await waitFor(() => expect(lastCall()).toMatchObject({ branch_id: 4 }));
    await waitFor(() => expect(lastCall().user_id).toBeUndefined());
    expect(repo.actors).toHaveBeenLastCalledWith(4);
  });
});

describe("the rows", () => {
  test("date on the venue clock, who and their role, the action, the branch, old → new price", async () => {
    await mount();
    const r = await screen.findByTestId("product-history-row");
    expect(r.textContent).toContain("Tea · productHistory.action.price_changed");
    expect(r.textContent).toContain("09.11.2026 12:05");
    expect(r.textContent).toContain("Anna Hakobyan (role.manager)");
    expect(r.textContent).toContain("Abovyan 1");
    expect(screen.getByTestId("product-history-change").textContent).toBe("300.00 AMD → 350.00 AMD");
    expect(screen.getByTestId("product-history-total").textContent).toContain("1");
  });

  test("a rename reads old → new value", async () => {
    repo.list.mockResolvedValue(page([row({ action: "renamed", old_price: null, new_price: null, before: { name: "Tea" }, after: { name: "Green tea" } })]));
    await mount();
    expect((await screen.findByTestId("product-history-change")).textContent).toBe("Tea → Green tea");
  });
});

describe("the states", () => {
  test("nothing recorded yet says so", async () => {
    repo.list.mockResolvedValue(page([]));
    await mount();
    expect(await screen.findByText("productHistory.state.emptyTitle")).toBeTruthy();
  });

  test("nothing under the filters says that instead", async () => {
    repo.list.mockResolvedValue(page([]));
    await mount();
    await act(async () => { change("product-history-action", "deleted"); });
    expect(await screen.findByText("productHistory.state.noMatchTitle")).toBeTruthy();
  });

  test("a failed read is an error, never «empty»", async () => {
    repo.list.mockRejectedValue(Object.assign(new Error("HTTP 500"), { status: 500 }));
    await mount();
    expect(await screen.findByText("productHistory.state.errorTitle")).toBeTruthy();
    expect(screen.queryByText("productHistory.state.emptyTitle")).toBeNull();
  });
});
