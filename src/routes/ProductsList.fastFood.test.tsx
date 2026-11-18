// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The Products screen's «Быстрая Еда» tab (2026-11-18, owner): «Товары»
 * lists the regular products that are not fast food, «Быстрая Еда» the fast
 * food, each with whose it is for the owner; a new product from that tab
 * starts as fast food. A manager never asks for partners and sees none.
 */

const repo = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/repositories/ProductRepository", () => ({
  productRepository: { listWithStock: (...a: unknown[]) => repo.list(...a), update: vi.fn(), remove: vi.fn() },
}));
const branches = vi.hoisted(() => ({ byId: vi.fn() }));
vi.mock("@/repositories/BranchRepository", () => ({ branchRepository: { byId: (...a: unknown[]) => branches.byId(...a) } }));
const partnersRepo = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/repositories/PartnerRepository", () => ({ partnerRepository: { list: (...a: unknown[]) => partnersRepo.list(...a) } }));
const form = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock("@/components/products/ProductForm", () => ({
  default: (props: Record<string, unknown>) => { form.props = props; return <div data-testid="product-form" />; },
}));
vi.mock("@/components/products/ProductStockDialog", () => ({ default: () => null }));
const T: Record<string, string> = { "products.partnerOf": "partner {0}" };
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => T[k] ?? k, money: (n: number) => `${n}`, lang: "ru" }) }));
const auth = vi.hoisted(() => ({ role: "company_owner" as string }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: auth.role } }) }));
vi.mock("@/repositories/ProductEventRepository", () => ({ productEventRepository: { available: async () => false } }));
vi.mock("@/components/products/ProductHistory", () => ({ default: () => null }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async () => true }));

import ProductsList from "./ProductsList";

const PRODUCTS = [
  { id: 1, branch_id: 3, name: "Кола", category: null, price: 500, is_active: true, kind: "regular", is_fast_food: false, partner_id: null },
  { id: 2, branch_id: 3, name: "Бургер", category: null, price: 1500, is_active: true, kind: "regular", is_fast_food: true, partner_id: 7 },
  { id: 3, branch_id: 3, name: "Хот-дог", category: null, price: 900, is_active: true, kind: "regular", is_fast_food: true, partner_id: null },
  { id: 4, branch_id: 3, name: "Кий", category: null, price: 700, is_active: true, kind: "additional" },
  // An older backend sends no flag: a product.
  { id: 5, branch_id: 3, name: "Вода", category: null, price: 200, is_active: true },
];
const PARTNERS = [{ id: 7, company_id: 1, name: "Pizza House", terms: "percent", percent: "10.00", fixed_amount: null, active: true, archived: false }];

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/branches/3/products"]}>
        <Routes><Route path="/branches/:branchId/products" element={<ProductsList />} /></Routes>
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve(); });
};
const tab = async (label: string) => { await act(async () => { fireEvent.click(screen.getByRole("tab", { name: label })); }); };
const names = () => screen.getAllByTestId("product-row").map((r) => r.querySelector(".name")?.textContent);

beforeEach(() => {
  repo.list.mockReset();
  repo.list.mockResolvedValue({ products: PRODUCTS, stock: null });
  branches.byId.mockReset();
  branches.byId.mockResolvedValue({ id: 3, company_id: 1 });
  partnersRepo.list.mockReset();
  partnersRepo.list.mockResolvedValue(PARTNERS);
  auth.role = "company_owner";
  form.props = null;
});
afterEach(() => cleanup());

describe("ProductsList — «Быстрая Еда»", () => {
  test("three tabs; «Товары» holds the products that are not fast food", async () => {
    await mount();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["session.sectionProducts", "products.tabFastFood", "session.additionalTitle"]);
    expect(names()).toEqual(["Кола", "Вода"]);
  });

  test("«Быстрая Еда» holds the fast food, each with whose it is, for the owner", async () => {
    await mount();
    await tab("products.tabFastFood");
    expect(names()).toEqual(["Бургер", "Хот-дог"]);
    expect(screen.getAllByTestId("product-partner-name").map((n) => n.textContent)).toEqual(["partner Pizza House", "product.partnerOwn"]);
    // The partners of the branch's company, archived ones too (an old product may still be theirs).
    expect(branches.byId).toHaveBeenCalledWith(3);
    expect(partnersRepo.list).toHaveBeenCalledWith(1, true);
  });

  test("a new product from that tab starts as fast food, with the partner list", async () => {
    await mount();
    await tab("products.tabFastFood");
    expect(screen.getByTestId("product-new").textContent).toBe("products.newFastFood");
    await act(async () => { fireEvent.click(screen.getByTestId("product-new")); });
    expect(form.props).toMatchObject({ kind: "regular", fastFood: true, partners: PARTNERS });
  });

  test("a new product from «Товары» is not fast food", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("product-new")); });
    expect(form.props).toMatchObject({ kind: "regular", fastFood: false });
  });

  test("a manager: the tab and its products, but no partner is asked for or shown, and the form gets no list", async () => {
    auth.role = "manager";
    await mount();
    await tab("products.tabFastFood");
    expect(names()).toEqual(["Бургер", "Хот-дог"]);
    expect(screen.queryByTestId("product-partner-name")).toBeNull();
    expect(branches.byId).not.toHaveBeenCalled();
    expect(partnersRepo.list).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByTestId("product-new")); });
    expect(form.props?.partners).toBeUndefined();
  });

  test("the fast-food tab, empty, says so in its own words", async () => {
    repo.list.mockResolvedValue({ products: PRODUCTS.filter((p) => !p.is_fast_food), stock: null });
    await mount();
    await tab("products.tabFastFood");
    expect(screen.getByText("products.state.emptyFastFoodTitle")).toBeTruthy();
  });
});
