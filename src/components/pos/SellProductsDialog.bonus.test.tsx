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
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async () => true }));
const ARMAN = { id: 42, branch_id: 7, name: "Arman", phone: "+37491123456", balance: "600.00", opened_at: null };
vi.mock("@/repositories/BonusRepository", () => ({
  bonusRepository: { settings: () => Promise.resolve({ enabled: true, percent: "5.00", welcome: "0.00" }), list: () => Promise.resolve([ARMAN]) },
}));

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


const sellTea = async () => {
  await act(async () => { fireEvent.click(screen.getByLabelText("action.add: Tea")); });
};
const confirm = async () => { await act(async () => { fireEvent.click(screen.getByText("till.sellConfirm").closest("button")!); }); };
const chooseArman = async () => {
  await act(async () => { fireEvent.click(screen.getByTestId("bonus-card-switch")); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { fireEvent.click(screen.getByTestId("bonus-pick-42")); });
};

describe("a till sale with a Club Card (2026-11-25)", () => {
  test("no card: the sale is sent exactly as before", async () => {
    await mount(true);
    await sellTea();
    await confirm();
    expect(repo.create).toHaveBeenCalledWith({ branch_id: 7, payment_method: "cash", items: [{ product_id: 1, quantity: 1 }], client_request_id: expect.any(String) });
  });

  test("with a card: «Бонусы» pays the 500 tea from the 600 card, and names the card", async () => {
    await mount(true);
    await sellTea();
    await chooseArman();
    await act(async () => { fireEvent.click(screen.getByTestId("pay-bonus")); });
    await confirm();
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ payment_method: "bonus", bonus_account_id: 42, items: [{ product_id: 1, quantity: 1 }] }));
  });

  test("«Использовать все бонусы» on a 1 200 basket with 600 bonuses: 600 + 600 cash", async () => {
    await mount(true);
    await sellTea();
    await act(async () => { fireEvent.click(screen.getByLabelText("action.add: Cola")); });
    await chooseArman();
    await act(async () => { fireEvent.click(screen.getByTestId("pay-bonus-use-all")); });
    await confirm();
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      payments: [{ method: "cash", amount: 600 }, { method: "bonus", amount: 600 }], bonus_account_id: 42,
    }));
  });
});
