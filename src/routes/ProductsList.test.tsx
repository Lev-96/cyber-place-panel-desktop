// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The Products screen in two sections (2026-09-27): what is sold, and what is
 * handed out with the seat. Each lists only its own; «New» creates the kind of
 * the open section; show/hide and delete name the kind for their toast.
 */

const repo = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("@/repositories/ProductRepository", () => ({
  productRepository: {
    listByBranch: (...a: unknown[]) => repo.list(...a),
    update: (...a: unknown[]) => repo.update(...a),
    remove: (...a: unknown[]) => repo.remove(...a),
  },
}));
const form = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock("@/components/products/ProductForm", () => ({
  default: (props: Record<string, unknown>) => { form.props = props; return <div data-testid="product-form" />; },
}));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => `${n}`, lang: "ru" }) }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "company_owner" } }) }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async () => true }));

import ProductsList from "./ProductsList";

const PRODUCTS = [
  { id: 1, branch_id: 3, name: "Tea", category: "Drinks", price: 300, is_active: true, kind: "regular" },
  { id: 2, branch_id: 3, name: "Billiard Cue", category: "Rentals", price: 500, is_active: true, kind: "additional" },
  { id: 3, branch_id: 3, name: "Old Cola", category: "Drinks", price: 600, is_active: true },
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
const tab = (name: string) => screen.getByRole("tab", { name }) as HTMLButtonElement;

beforeEach(() => {
  repo.list.mockReset(); repo.update.mockReset(); repo.remove.mockReset();
  repo.list.mockResolvedValue(PRODUCTS);
  repo.update.mockResolvedValue({});
  repo.remove.mockResolvedValue(undefined);
  form.props = null;
});
afterEach(() => cleanup());

describe("ProductsList — two sections", () => {
  test("products first: only what is sold (an older row with no kind included)", async () => {
    await mount();
    expect(tab("session.sectionProducts").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Tea")).toBeTruthy();
    expect(screen.getByText("Old Cola")).toBeTruthy();
    expect(screen.queryByText("Billiard Cue")).toBeNull();
    expect(screen.getByText("products.new")).toBeTruthy();
  });

  test("the additional items section lists only those, and «New» creates one", async () => {
    await mount();
    await act(async () => { fireEvent.click(tab("session.additionalTitle")); });
    expect(screen.getByText("Billiard Cue")).toBeTruthy();
    expect(screen.queryByText("Tea")).toBeNull();

    await act(async () => { fireEvent.click(screen.getByText("products.newAdditional")); });
    expect(form.props?.kind).toBe("additional");
  });

  test("an empty section says what belongs there", async () => {
    repo.list.mockResolvedValue(PRODUCTS.filter((p) => p.kind !== "additional"));
    await mount();
    await act(async () => { fireEvent.click(tab("session.additionalTitle")); });
    expect(screen.getByText("products.emptyAdditional")).toBeTruthy();
  });

  test("hiding and deleting an additional item name its kind for the toast", async () => {
    await mount();
    await act(async () => { fireEvent.click(tab("session.additionalTitle")); });
    await act(async () => { fireEvent.click(screen.getByText("action.hide")); });
    expect(repo.update).toHaveBeenCalledWith(2, { is_active: false }, "additional");
    await act(async () => { fireEvent.click(screen.getByText("action.delete")); });
    expect(repo.remove).toHaveBeenCalledWith(2, "additional");
  });
});
