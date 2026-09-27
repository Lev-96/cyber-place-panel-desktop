// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IProduct } from "@/types/pos";
import ProductForm from "./ProductForm";

/**
 * The product form's one new question (2026-09-27): is this sold by the unit,
 * or handed out with the seat? It travels as `kind`; everything else about the
 * form is unchanged.
 */

const repo = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/repositories/ProductRepository", () => ({
  productRepository: { create: (...a: unknown[]) => repo.create(...a), update: (...a: unknown[]) => repo.update(...a) },
}));
vi.mock("@/api/translations", () => ({ apiSaveEntityTranslations: vi.fn(async () => ({})) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "ru" }) }));
vi.mock("@/components/ui/MultiLangInput", () => ({
  default: ({ label, onChange }: { label: string; onChange: (v: Record<string, string>) => void }) => (
    <input aria-label={label} onChange={(e) => onChange({ ru: e.target.value })} />
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

const mount = async (initial?: IProduct) => {
  const onSaved = vi.fn();
  await act(async () => { render(<ProductForm branchId={3} initial={initial} onClose={() => {}} onSaved={onSaved} />); });
  return { onSaved };
};
const checkbox = () => screen.getByRole("checkbox") as HTMLInputElement;
const save = async () => { await act(async () => { fireEvent.click(screen.getByText("action.save")); }); };

beforeEach(() => {
  repo.create.mockReset();
  repo.update.mockReset();
  repo.create.mockResolvedValue({ id: 5 });
  repo.update.mockResolvedValue({ id: 5 });
});
afterEach(() => cleanup());

describe("ProductForm — additional item", () => {
  test("a new product is sold by the unit unless the box is ticked", async () => {
    await mount();
    expect(checkbox().checked).toBe(false);
    await act(async () => {
      fireEvent.change(screen.getByLabelText("label.name"), { target: { value: "Tea" } });
      fireEvent.change(screen.getByLabelText("label.price"), { target: { value: "300" } });
    });
    await save();
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Tea", price: 300, kind: "regular" }));
  });

  test("ticked, it is created as an additional item", async () => {
    await mount();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("label.name"), { target: { value: "Billiard Cue" } });
      fireEvent.change(screen.getByLabelText("label.price"), { target: { value: "500" } });
      fireEvent.click(checkbox());
    });
    await save();
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Billiard Cue", kind: "additional" }));
  });

  test("editing one opens ticked and can turn it back into a product", async () => {
    await mount({ id: 5, branch_id: 3, name: "Billiard Cue", category: null, price: 500, is_active: true, kind: "additional" });
    expect(checkbox().checked).toBe(true);
    await act(async () => { fireEvent.click(checkbox()); });
    await save();
    expect(repo.update).toHaveBeenCalledWith(5, expect.objectContaining({ kind: "regular" }));
  });

  test("a product from an older server, with no kind, opens as a regular one", async () => {
    await mount({ id: 6, branch_id: 3, name: "Tea", category: null, price: 300, is_active: true });
    expect(checkbox().checked).toBe(false);
  });
});
