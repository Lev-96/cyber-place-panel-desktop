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
const auth = vi.hoisted(() => ({ role: "company_owner" as string }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: auth.role } }) }));
/** Whether the backend has the product trail: the probe the tab waits for. */
const events = vi.hoisted(() => ({ available: vi.fn() }));
vi.mock("@/repositories/ProductEventRepository", () => ({
  productEventRepository: { available: (...a: unknown[]) => events.available(...a) },
}));
vi.mock("@/components/products/ProductHistory", () => ({
  default: (props: { initialBranchId: number }) => <div data-testid="product-history-pane">{props.initialBranchId}</div>,
}));
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
  auth.role = "company_owner";
  events.available.mockReset();
  events.available.mockResolvedValue(true);
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
    expect(screen.getByText("products.state.emptyAdditionalTitle")).toBeTruthy();
    expect(screen.getByText("products.state.emptyAdditionalDescription")).toBeTruthy();
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

/**
 * Manager rights (2026-11-09): the branch's manager writes the catalogue —
 * create, edit, price, deactivate — and the delete stays the owner's.
 */
describe("ProductsList — who may change the catalogue", () => {
  test("a manager gets create, edit and deactivate, never delete", async () => {
    auth.role = "manager";
    await mount();
    expect(screen.getByText("products.new")).toBeTruthy();
    expect(screen.getByText("Tea").closest(".list-item")!.textContent).toContain("action.edit");
    expect(screen.queryAllByText("action.hide").length).toBeGreaterThan(0);
    expect(screen.queryByText("action.delete")).toBeNull();

    // Deactivating is the write a manager has instead of the delete.
    await act(async () => { fireEvent.click(screen.getAllByText("action.hide")[0]); });
    expect(repo.update).toHaveBeenCalledWith(1, { is_active: false }, "regular");
    await act(async () => { fireEvent.click(screen.getAllByText("action.edit")[0]); });
    expect(screen.getByTestId("product-form")).toBeTruthy();
  });

  test("an owner keeps the delete", async () => {
    await mount();
    expect(screen.getAllByText("action.delete").length).toBeGreaterThan(0);
  });
});

/** «История товаров»: owner and admin, and only on a backend that has it. */
describe("ProductsList — product history entry", () => {
  test("an owner gets the history tab, opened on this branch", async () => {
    await mount();
    expect(events.available).toHaveBeenCalledWith(3);
    await act(async () => { fireEvent.click(tab("products.viewHistory")); });
    expect(screen.getByTestId("product-history-pane").textContent).toBe("3");
    // The catalogue's own controls step aside while the trail is open.
    expect(screen.queryByText("products.new")).toBeNull();
    expect(screen.queryByText("Tea")).toBeNull();

    await act(async () => { fireEvent.click(tab("products.viewCatalogue")); });
    expect(screen.getByText("Tea")).toBeTruthy();
  });

  test("an admin gets it too", async () => {
    auth.role = "admin";
    await mount();
    expect(screen.getByRole("tab", { name: "products.viewHistory" })).toBeTruthy();
  });

  test("a manager never sees it, and the backend is not even asked", async () => {
    auth.role = "manager";
    await mount();
    expect(screen.queryByRole("tab", { name: "products.viewHistory" })).toBeNull();
    expect(screen.queryByTestId("product-history-pane")).toBeNull();
    expect(events.available).not.toHaveBeenCalled();
  });

  test("a backend without the trail (404) hides the entry", async () => {
    events.available.mockResolvedValue(false);
    await mount();
    expect(events.available).toHaveBeenCalledWith(3);
    expect(screen.queryByRole("tab", { name: "products.viewHistory" })).toBeNull();
    // The catalogue is untouched.
    expect(screen.getByText("Tea")).toBeTruthy();
    expect(screen.getAllByText("action.delete").length).toBeGreaterThan(0);
  });
});
