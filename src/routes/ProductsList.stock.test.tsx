// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The Products screen says each product's stock and the total (2026-11-16):
 * «Остаток: 15», «Без учёта», red below zero; the total is the server's
 * `meta.stock`, never added up here. Additional items are not stock.
 */

const repo = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/repositories/ProductRepository", () => ({
  productRepository: { listWithStock: (...a: unknown[]) => repo.list(...a), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/components/products/ProductForm", () => ({ default: () => <div data-testid="product-form" /> }));
const dialog = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock("@/components/products/ProductStockDialog", () => ({
  default: (props: Record<string, unknown>) => { dialog.props = props; return <div data-testid="stock-dialog" />; },
}));
/** The stock lines keep their figure on screen, so a test can read which figure was printed. */
const T: Record<string, string> = { "stock.total": "total {0}", "stock.negative": "below {0}", "stock.left": "left {0}" };
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => T[k] ?? k, money: (n: number) => `${n}`, lang: "ru" }) }));
const auth = vi.hoisted(() => ({ role: "manager" as string }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: auth.role } }) }));
vi.mock("@/repositories/ProductEventRepository", () => ({ productEventRepository: { available: async () => false } }));
vi.mock("@/components/products/ProductHistory", () => ({ default: () => null }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async () => true }));

import ProductsList from "./ProductsList";

const PRODUCTS = [
  { id: 1, branch_id: 3, name: "Кола", category: "Напитки", price: 500, is_active: true, kind: "regular", stock: 15 },
  { id: 2, branch_id: 3, name: "Чипсы", category: null, price: 300, is_active: true, kind: "regular", stock: -2 },
  { id: 3, branch_id: 3, name: "Вода", category: null, price: 200, is_active: true, kind: "regular", stock: null },
  { id: 4, branch_id: 3, name: "Кий", category: null, price: 700, is_active: true, kind: "additional", stock: null },
];

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/branches/3/products"]}>
        <Routes><Route path="/branches/:branchId/products" element={<ProductsList />} /></Routes>
      </MemoryRouter>,
    );
  });
};

beforeEach(() => {
  repo.list.mockReset();
  repo.list.mockResolvedValue({ products: PRODUCTS, stock: { units: 13, tracked: 2, untracked: 1, negative: 1 } });
  auth.role = "manager";
  dialog.props = null;
});
afterEach(() => cleanup());

describe("ProductsList — stock", () => {
  test("each product sold by the unit says its count; below zero is marked", async () => {
    await mount();
    const labels = screen.getAllByTestId("product-stock");
    expect(labels.map((l) => l.textContent)).toEqual(["left 15", "left \u22122", "stock.notCounted"]);
    expect(labels.map((l) => l.classList.contains("is-negative"))).toEqual([false, true, false]);
  });

  test("the total is the server's figure, never one added up here", async () => {
    // The rows on screen add up to 13; the server says 113 (it counts what
    // this list does not show) — and 113 is what is printed.
    repo.list.mockResolvedValue({ products: PRODUCTS, stock: { units: 113, tracked: 2, untracked: 1, negative: 1 } });
    await mount();
    expect(screen.getByTestId("product-stock-total").textContent).toContain("total 113");
    expect(screen.getByTestId("product-stock-negative").textContent).toBe("below 1");
  });

  test("no total from a server that does not count, nor when nothing counts", async () => {
    repo.list.mockResolvedValue({ products: PRODUCTS.map((p) => ({ ...p, stock: undefined })), stock: null });
    await mount();
    expect(screen.queryByTestId("product-stock-total")).toBeNull();
    cleanup();
    repo.list.mockResolvedValue({ products: PRODUCTS, stock: { units: 0, tracked: 0, untracked: 3, negative: 0 } });
    await mount();
    expect(screen.queryByTestId("product-stock-total")).toBeNull();
  });

  test("additional items carry no stock and no stock button", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "session.additionalTitle" })); });
    expect(screen.getByText("Кий")).toBeTruthy();
    expect(screen.queryByTestId("product-stock")).toBeNull();
    expect(screen.queryByTestId("product-stock-button")).toBeNull();
    expect(screen.queryByTestId("product-stock-total")).toBeNull();
  });

  test("the stock button opens the dialog: a manager may not correct, an owner may", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getAllByTestId("product-stock-button")[0]); });
    expect(screen.getByTestId("stock-dialog")).toBeTruthy();
    expect(dialog.props).toMatchObject({ canCorrect: false, product: expect.objectContaining({ id: 1 }) });

    cleanup();
    auth.role = "company_owner";
    await mount();
    await act(async () => { fireEvent.click(screen.getAllByTestId("product-stock-button")[1]); });
    expect(dialog.props).toMatchObject({ canCorrect: true, product: expect.objectContaining({ id: 2 }) });
  });
});
