// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import SellProductsDialog from "./SellProductsDialog";

/**
 * The basket says a counted product's shelf (2026-11-16): «ост. 15» beside it
 * in the list and on a typed line — a hint, never a limit: a product at zero
 * or below is still added and sold.
 */

const repo = vi.hoisted(() => ({ create: vi.fn(), resolve: vi.fn(), listProducts: vi.fn() }));
vi.mock("@/repositories/OrderRepository", () => ({
  orderRepository: { create: (...a: unknown[]) => repo.create(...a), resolveItemsText: (...a: unknown[]) => repo.resolve(...a), list: vi.fn() },
}));
vi.mock("@/repositories/SessionRepository", () => ({ sessionRepository: { addItems: vi.fn(), resolveItemsText: vi.fn() } }));
vi.mock("@/repositories/ProductRepository", () => ({ productRepository: { listByBranch: (...a: unknown[]) => repo.listProducts(...a) } }));
vi.mock("@/components/products/ProductForm", () => ({ default: () => null }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ currency: "AMD", t: (k: string) => (k === "stock.chip" ? "ост. {0}" : k), money: (n: number) => String(n), lang: "ru" }) }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: vi.fn() } }));

const PRODUCTS = [
  { id: 1, branch_id: 7, name: "Tea", category: "Drinks", price: 500, is_active: true, stock: 15 },
  { id: 2, branch_id: 7, name: "Cola", category: "Drinks", price: 700, is_active: true, stock: -2 },
  { id: 3, branch_id: 7, name: "Water", category: "Drinks", price: 200, is_active: true, stock: null },
  { id: 4, branch_id: 7, name: "Juice", category: "Drinks", price: 400, is_active: true, stock: 0 },
];

const mount = async (list: boolean) => {
  await act(async () => { render(<SellProductsDialog branchId={7} onClose={() => {}} onSold={() => {}} />); });
  if (list) await act(async () => { fireEvent.click(screen.getByLabelText("session.addModePicker")); });
};

beforeEach(() => {
  Object.values(repo).forEach((f) => f.mockReset());
  repo.listProducts.mockResolvedValue(PRODUCTS);
  repo.create.mockResolvedValue({ id: 99 });
});
afterEach(() => cleanup());

describe("the basket's stock chip", () => {
  test("each counted product says its shelf; red below zero, amber at zero, nothing when not counted", async () => {
    await mount(true);
    const chips = screen.getAllByTestId("stock-chip");
    expect(chips.map((c) => c.textContent)).toEqual(["ост. 15", "ост. −2", "ост. 0"]);
    expect(chips.map((c) => c.className)).toEqual(["stock-chip", "stock-chip is-negative", "stock-chip is-empty"]);
  });

  test("a product below zero is still added and sold: the chip is a hint, never a limit", async () => {
    await mount(true);
    await act(async () => { fireEvent.click(screen.getByLabelText("action.add: Cola")); });
    await act(async () => { fireEvent.click(screen.getByText("till.sellConfirm").closest("button")!); });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ items: [{ product_id: 2, quantity: 1 }] }));
  });

  test("a typed line says the shelf of the product it read", async () => {
    repo.resolve.mockResolvedValue({
      lines: [{ raw: "tea 2", status: "matched", product_id: 1, name: "Tea", qty: 2, price: 500, line_total: 1000, error: null, candidates: [] }],
      items: [{ product_id: 1, qty: 2 }], total: 1000, ok: true,
    });
    await mount(false);
    await act(async () => { fireEvent.change(screen.getByLabelText("session.quickEntry"), { target: { value: "tea 2" } }); });
    await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
    expect(screen.getByTestId("stock-chip").textContent).toBe("ост. 15");
  });
});
