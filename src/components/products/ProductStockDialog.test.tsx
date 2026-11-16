// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IProduct } from "@/types/pos";
import ProductStockDialog from "./ProductStockDialog";

/**
 * A product's stock (2026-11-16): a manager receives goods and starts a
 * count; only the owner recounts a counted product or switches counting off.
 * The bodies are the server's contract; the toast says the server's answer.
 */

const repo = vi.hoisted(() => ({ stock: vi.fn() }));
vi.mock("@/repositories/ProductRepository", () => ({ productRepository: { stock: (...a: unknown[]) => repo.stock(...a) } }));
const toasts = vi.hoisted(() => ({ message: vi.fn() }));
vi.mock("@/ui/notify", () => ({ notify: { message: (...a: unknown[]) => toasts.message(...a) } }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "ru" }) }));

const COLA: IProduct = { id: 7, branch_id: 3, name: "Кола", category: null, price: 500, is_active: true, kind: "regular", stock: 5 };
const WATER: IProduct = { id: 8, branch_id: 3, name: "Вода", category: null, price: 200, is_active: true, kind: "regular", stock: null };

const mount = async (product: IProduct, canCorrect: boolean) => {
  const onDone = vi.fn();
  await act(async () => { render(<ProductStockDialog product={product} canCorrect={canCorrect} onClose={() => {}} onDone={onDone} />); });
  return { onDone };
};
const type = async (v: string) => { await act(async () => { fireEvent.change(screen.getByTestId("product-stock-qty"), { target: { value: v } }); }); };
const confirm = async () => { await act(async () => { fireEvent.click(screen.getByTestId("product-stock-confirm")); }); };
const pick = async (action: string) => { await act(async () => { fireEvent.click(screen.getByTestId(`product-stock-action-${action}`).querySelector("input")!); }); };

beforeEach(() => { repo.stock.mockReset(); toasts.message.mockReset(); });
afterEach(() => cleanup());

describe("ProductStockDialog", () => {
  test("a manager on a counted product receives goods, and only that", async () => {
    repo.stock.mockResolvedValue({ product: { ...COLA, stock: 15 }, change: { before: 5, after: 15, delta: 10 } });
    const { onDone } = await mount(COLA, false);
    expect(screen.getByTestId("product-stock-now").textContent).toBe("stock.now");
    expect(screen.queryByTestId("product-stock-action")).toBeNull();
    expect(screen.getByText("stock.action.add")).toBeTruthy();
    expect(screen.getByText("stock.ownerOnly")).toBeTruthy();

    await type("10");
    await confirm();

    expect(repo.stock).toHaveBeenCalledWith(7, { action: "add", qty: 10, client_request_id: expect.any(String) });
    expect(toasts.message).toHaveBeenCalledWith("success", "stock.done");
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ stock: 15 }));
  });

  test("a product not counted yet has one thing to do: start counting, a manager's to do", async () => {
    repo.stock.mockResolvedValue({ product: { ...WATER, stock: 7 }, change: { before: null, after: 7, delta: 7 } });
    await mount(WATER, false);
    expect(screen.getByText("stock.action.start")).toBeTruthy();
    expect(screen.queryByText("stock.ownerOnly")).toBeNull();
    await type("7");
    await confirm();
    expect(repo.stock).toHaveBeenCalledWith(8, { action: "set", stock: 7, client_request_id: expect.any(String) });
  });

  test("the owner recounts and switches counting off", async () => {
    repo.stock.mockResolvedValue({ product: { ...COLA, stock: 4 }, change: { before: 5, after: 4, delta: -1 } });
    await mount(COLA, true);
    expect(screen.getByTestId("product-stock-action")).toBeTruthy();
    await pick("set");
    await type("4");
    await confirm();
    expect(repo.stock).toHaveBeenLastCalledWith(7, { action: "set", stock: 4, client_request_id: expect.any(String) });

    cleanup();
    repo.stock.mockResolvedValue({ product: { ...COLA, stock: null }, change: { before: 5, after: null, delta: -5 } });
    await mount(COLA, true);
    await pick("untrack");
    expect(screen.queryByTestId("product-stock-qty")).toBeNull();
    await confirm();
    expect(repo.stock).toHaveBeenLastCalledWith(7, { action: "untrack", client_request_id: expect.any(String) });
  });

  test("a receipt is at least one, a count at least zero, and nothing is sent otherwise", async () => {
    await mount(COLA, true);
    await type("0");
    await confirm();
    expect(screen.getByText("stock.errors.qty")).toBeTruthy();
    await pick("set");
    await type("-3");
    await confirm();
    expect(screen.getByText("stock.errors.count")).toBeTruthy();
    expect(repo.stock).not.toHaveBeenCalled();
  });

  test("a second press of the same dialog is the same receipt", async () => {
    repo.stock.mockRejectedValueOnce(new Error("Network down"));
    repo.stock.mockResolvedValueOnce({ product: { ...COLA, stock: 15 }, change: { before: 5, after: 15, delta: 10 } });
    await mount(COLA, false);
    await type("10");
    await confirm();
    expect(screen.getByText("Network down")).toBeTruthy();
    await confirm();
    const [first, second] = repo.stock.mock.calls.map((c) => c[1]);
    expect(second.client_request_id).toBe(first.client_request_id);
  });

  test("a recount to the same figure says the stock already is that", async () => {
    repo.stock.mockResolvedValue({ product: COLA, change: { before: 5, after: 5, delta: 0 } });
    await mount(COLA, true);
    await pick("set");
    await type("5");
    await confirm();
    expect(toasts.message).toHaveBeenCalledWith("success", "stock.unchanged");
  });
});
