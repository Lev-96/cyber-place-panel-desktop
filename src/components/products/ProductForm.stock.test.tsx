// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IProduct } from "@/types/pos";
import ProductForm from "./ProductForm";

/**
 * «Количество» on a new product (2026-11-16): empty is the create it always
 * was; a number asks the server to match the name — a merge into the product
 * already there (its names are NOT translated over), a new counted product,
 * or a question answered in the form («Добавить к остатку» / «Добавить и
 * сменить цену»). One press is one receipt.
 */

const repo = vi.hoisted(() => ({ create: vi.fn(), createCounted: vi.fn(), update: vi.fn() }));
vi.mock("@/repositories/ProductRepository", () => ({
  productRepository: {
    create: (...a: unknown[]) => repo.create(...a),
    createCounted: (...a: unknown[]) => repo.createCounted(...a),
    update: (...a: unknown[]) => repo.update(...a),
  },
}));
const translations = vi.hoisted(() => ({ save: vi.fn(async () => ({})) }));
vi.mock("@/api/translations", () => ({ apiSaveEntityTranslations: (...a: unknown[]) => translations.save(...(a as [])) }));
const toasts = vi.hoisted(() => ({ message: vi.fn() }));
vi.mock("@/ui/notify", () => ({ notify: { message: (...a: unknown[]) => toasts.message(...a) } }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "ru", money: (n: number) => `${n} ֏` }) }));
vi.mock("@/components/ui/MultiLangInput", () => ({
  default: ({ label, onChange, disabled }: { label: string; onChange: (v: Record<string, string>) => void; disabled?: boolean }) => (
    <input aria-label={label} disabled={disabled} onChange={(e) => onChange({ ru: e.target.value })} />
  ),
  langValuesFromField: (_i: unknown, _f: string, v: string | null | undefined) => ({ ru: v ?? "" }),
  primaryValue: (v: Record<string, string>) => v.ru ?? "",
  hasAnyValue: (v: Record<string, string>) => Object.values(v).some((x) => x.trim() !== ""),
}));
vi.mock("@/components/ui/PriceInput", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const COLA: IProduct = { id: 7, branch_id: 3, name: "Кола", category: null, price: 500, is_active: true, kind: "regular", stock: 15 };
const exists = (matches: unknown[]) => Object.assign(new Error("«Кола» уже есть"), {
  status: 409,
  body: { message: "«Кола» уже есть", code: "product_exists", name: "Кола", matches, choices: ["add", "add_and_reprice"] },
});
const match = (over: Record<string, unknown> = {}) => ({ id: 7, name: "Кола", i18n: null, category: null, price: "500.00", stock: 5, is_active: true, ...over });

const mount = async (initial?: IProduct, kind?: "regular" | "additional") => {
  const onSaved = vi.fn();
  await act(async () => { render(<ProductForm branchId={3} initial={initial} kind={kind} onClose={() => {}} onSaved={onSaved} />); });
  return { onSaved };
};
const fill = async (name: string, price: string, qty?: string) => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("label.name"), { target: { value: name } });
    fireEvent.change(screen.getByLabelText("label.price"), { target: { value: price } });
    if (qty !== undefined) fireEvent.change(screen.getByTestId("product-quantity"), { target: { value: qty } });
  });
};
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };

beforeEach(() => {
  repo.create.mockReset(); repo.createCounted.mockReset(); repo.update.mockReset();
  translations.save.mockClear(); toasts.message.mockReset();
  repo.create.mockResolvedValue({ id: 5 });
  repo.update.mockResolvedValue({ id: 5 });
});
afterEach(() => cleanup());

describe("ProductForm — «Количество»", () => {
  test("is asked only of a new product sold by the unit", async () => {
    await mount();
    expect(screen.getByTestId("product-quantity")).toBeTruthy();
    cleanup();
    await mount(undefined, "additional");
    expect(screen.queryByTestId("product-quantity")).toBeNull();
    cleanup();
    await mount(COLA);
    expect(screen.queryByTestId("product-quantity")).toBeNull();
  });

  test("left empty, the create is the one it always was: no stock, no matching", async () => {
    await mount();
    await fill("Кола", "500", "");
    await click(screen.getByText("action.save"));
    expect(repo.createCounted).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create.mock.calls[0][0]).not.toHaveProperty("stock");
    expect(repo.create.mock.calls[0][0]).not.toHaveProperty("client_request_id");
  });

  test("a quantity that is not a count is refused before anything is sent", async () => {
    await mount();
    await fill("Кола", "500", "2.5");
    await click(screen.getByText("action.save"));
    expect(screen.getByText("product.errors.quantity")).toBeTruthy();
    expect(repo.createCounted).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  test("a new counted product: the quantity and one press id go, and its names are saved", async () => {
    repo.createCounted.mockResolvedValue({ product: { ...COLA, id: 9, stock: 10 }, merged: false, stock_change: { before: null, after: 10, delta: 10 } });
    const { onSaved } = await mount();
    await fill("Кола", "500", "10");
    await click(screen.getByText("action.save"));

    const body = repo.createCounted.mock.calls[0][0];
    expect(body).toMatchObject({ branch_id: 3, name: "Кола", price: 500, stock: 10, kind: "regular" });
    expect(typeof body.client_request_id).toBe("string");
    expect(body).not.toHaveProperty("on_existing");
    expect(translations.save).toHaveBeenCalledWith("product", 9, expect.anything());
    expect(toasts.message).toHaveBeenCalledWith("success", "product.createdCounted");
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 9, stock: 10 }));
  });

  test("the same name at the same price: added to it, and its names are left alone", async () => {
    repo.createCounted.mockResolvedValue({ product: COLA, merged: true, stock_change: { before: 5, after: 15, delta: 10 } });
    const { onSaved } = await mount();
    await fill("кола", "500", "10");
    await click(screen.getByText("action.save"));

    expect(translations.save).not.toHaveBeenCalled();
    expect(toasts.message).toHaveBeenCalledWith("success", "product.mergedToast");
    expect(onSaved).toHaveBeenCalledWith(COLA);
  });

  test("another price: the form asks, and «Добавить к остатку» sends the answer with the same press id", async () => {
    repo.createCounted.mockRejectedValueOnce(exists([match()]));
    repo.createCounted.mockResolvedValueOnce({ product: COLA, merged: true, stock_change: { before: 5, after: 15, delta: 10 } });
    const { onSaved } = await mount();
    await fill("Кола", "600", "10");
    await click(screen.getByText("action.save"));

    expect(screen.getByTestId("product-merge")).toBeTruthy();
    expect(screen.getByText("product.exists.title")).toBeTruthy();
    // The Save button steps aside while the question is open.
    expect(screen.queryByText("action.save")).toBeNull();
    expect(screen.getByTestId("product-merge-reprice").textContent).toBe("product.exists.addReprice");

    await click(screen.getByTestId("product-merge-add"));
    const [first, second] = repo.createCounted.mock.calls.map((c) => c[0]);
    expect(second).toMatchObject({ stock: 10, on_existing: "add", existing_id: 7, price: 600 });
    expect(second.client_request_id).toBe(first.client_request_id);
    expect(onSaved).toHaveBeenCalledWith(COLA);
  });

  test("«Добавить и сменить цену» answers add_and_reprice", async () => {
    repo.createCounted.mockRejectedValueOnce(exists([match()]));
    repo.createCounted.mockResolvedValueOnce({ product: { ...COLA, price: 600 }, merged: true, stock_change: { before: 5, after: 15, delta: 10 } });
    await mount();
    await fill("Кола", "600", "10");
    await click(screen.getByText("action.save"));
    await click(screen.getByTestId("product-merge-reprice"));
    expect(repo.createCounted.mock.calls[1][0]).toMatchObject({ on_existing: "add_and_reprice", existing_id: 7 });
  });

  test("several of that name: nothing is picked until the cashier picks, and the price is offered only when new", async () => {
    repo.createCounted.mockRejectedValueOnce(exists([match({ id: 7 }), match({ id: 8, name: "КОЛА", stock: null, is_active: false })]));
    await mount();
    await fill("кола", "500", "3");
    await click(screen.getByText("action.save"));

    expect((screen.getByTestId("product-merge-add") as HTMLButtonElement).disabled).toBe(true);
    await click(screen.getByTestId("product-merge-choice-8").querySelector("input")!);
    expect((screen.getByTestId("product-merge-add") as HTMLButtonElement).disabled).toBe(false);
    // Same price as typed: «сменить цену» would change nothing, so it is not offered.
    expect(screen.queryByTestId("product-merge-reprice")).toBeNull();
    expect(screen.getByTestId("product-merge-choice-8").textContent).toContain("product.exists.hidden");
  });

  test("«Назад» returns to the form with everything typed, and nothing was written", async () => {
    repo.createCounted.mockRejectedValueOnce(exists([match()]));
    await mount();
    await fill("Кола", "600", "10");
    await click(screen.getByText("action.save"));
    await click(screen.getByText("action.back"));
    expect(screen.queryByTestId("product-merge")).toBeNull();
    expect((screen.getByTestId("product-quantity") as HTMLInputElement).value).toBe("10");
    expect(repo.createCounted).toHaveBeenCalledTimes(1);
  });
});
