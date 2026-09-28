// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Till from "./Till";

/**
 * Касса: today's sales at this till, their totals by method — PAID sales only
 * — and «Продать товар». A failed read is an error on screen, never an empty
 * day: a money history that reads "nothing sold" when the request failed is
 * the worst kind of wrong.
 */
const repo = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/repositories/OrderRepository", () => ({
  orderRepository: { list: (...a: unknown[]) => repo.list(...a), create: vi.fn(), resolveItemsText: vi.fn() },
}));
const dialog = vi.hoisted(() => ({ sold: null as null | (() => void) }));
vi.mock("@/components/pos/SellProductsDialog", () => ({
  default: ({ onSold }: { onSold: () => void }) => { dialog.sold = onSold; return <div data-testid="sell-dialog" />; },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

const ORDERS = [
  { id: 1, branch_id: 7, total: 1000, payment_method: "cash", status: "paid", created_at: "2026-09-24T10:00:00Z",
    items: [{ product_name: "Tea", quantity: 2 }], cashier: { id: 1, name: "Anna", role: "manager" } },
  { id: 2, branch_id: 7, total: 700, payment_method: "card", status: "paid", created_at: "2026-09-24T11:00:00Z",
    items: [{ product_name: "Coca-Cola", quantity: 1 }], cashier: { id: 1, name: "Anna", role: "manager" } },
  { id: 3, branch_id: 7, total: 300, payment_method: "other", payment_method_other: "Idram", status: "paid",
    created_at: "2026-09-24T12:00:00Z", items: [{ product_name: "Water", quantity: 1 }], cashier: null },
  { id: 4, branch_id: 7, total: 5000, payment_method: "cash", status: "voided", created_at: "2026-09-24T13:00:00Z",
    items: [{ product_name: "Lays", quantity: 10 }], cashier: null },
];

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/branches/7/pos"]}>
        <Routes><Route path="/branches/:branchId/pos" element={<Till />} /></Routes>
      </MemoryRouter>,
    );
  });
};

afterEach(() => cleanup());
beforeEach(() => { repo.list.mockReset(); dialog.sold = null; });

describe("Касса", () => {
  test("lists today's sales for this branch, from midnight", async () => {
    repo.list.mockResolvedValue(ORDERS);
    await mount();

    const params = repo.list.mock.calls[0][0];
    expect(params.branch_id).toBe(7);
    expect(params.date_from).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/);
    expect(screen.getByText("Tea × 2")).toBeTruthy();
    expect(document.body.textContent).toContain("session.payOther: Idram");
    expect(document.body.textContent).toContain("Anna");
  });

  test("totals count paid sales only, by method; a voided one stays listed and counts nothing", async () => {
    repo.list.mockResolvedValue(ORDERS);
    await mount();

    const today = screen.getByText("till.today").parentElement!;
    expect(today.textContent).toContain("2000");
    expect(document.body.textContent).toContain("session.payCash: 1000");
    expect(document.body.textContent).toContain("session.payCard: 700");
    expect(document.body.textContent).toContain("session.payOther: 300");
    expect(screen.getByText("Lays × 10")).toBeTruthy();
    expect(document.body.textContent).toContain("till.voided");
  });

  test("a failed read is shown as an error, not as a day with no sales", async () => {
    repo.list.mockRejectedValue(new Error("Server unavailable"));
    await mount();

    expect(screen.getByText("Server unavailable")).toBeTruthy();
    expect(screen.queryByText("till.empty")).toBeNull();
  });

  test("«Продать товар» opens the sale, and a sale re-reads the day", async () => {
    repo.list.mockResolvedValue([]);
    await mount();
    expect(screen.getByText("till.empty")).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByText("till.sell")); });
    expect(screen.getByTestId("sell-dialog")).toBeTruthy();

    await act(async () => { dialog.sold!(); });
    expect(repo.list).toHaveBeenCalledTimes(2);
  });
});
