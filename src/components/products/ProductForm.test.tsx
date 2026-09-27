// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IProduct } from "@/types/pos";
import ProductForm from "./ProductForm";

/**
 * What a new entry is — sold by the unit, or handed out with the seat — is
 * decided by the section it is created from (2026-09-27), not by a checkbox.
 * It travels as `kind` on create; an edit never changes it.
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

const mount = async (initial?: IProduct, kind?: "regular" | "additional") => {
  const onSaved = vi.fn();
  await act(async () => { render(<ProductForm branchId={3} initial={initial} kind={kind} onClose={() => {}} onSaved={onSaved} />); });
  return { onSaved };
};
const fill = async (name: string, price: string) => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("label.name"), { target: { value: name } });
    fireEvent.change(screen.getByLabelText("label.price"), { target: { value: price } });
  });
};
const save = async () => { await act(async () => { fireEvent.click(screen.getByText("action.save")); }); };

beforeEach(() => {
  repo.create.mockReset();
  repo.update.mockReset();
  repo.create.mockResolvedValue({ id: 5 });
  repo.update.mockResolvedValue({ id: 5 });
});
afterEach(() => cleanup());

describe("ProductForm — the section decides the kind", () => {
  test("from the products section: a product, and no checkbox to change it", async () => {
    await mount();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("product.titleNew")).toBeTruthy();
    await fill("Tea", "300");
    await save();
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Tea", price: 300, kind: "regular" }));
  });

  test("from the additional items section: created as an additional item, and titled so", async () => {
    await mount(undefined, "additional");
    expect(screen.getByText("product.titleNewAdditional")).toBeTruthy();
    await fill("Billiard Cue", "500");
    await save();
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Billiard Cue", kind: "additional" }));
  });

  test("editing keeps the entry's own kind and names it for the toast", async () => {
    await mount({ id: 5, branch_id: 3, name: "Billiard Cue", category: null, price: 500, is_active: true, kind: "additional" });
    expect(screen.getByText("product.titleEditAdditional")).toBeTruthy();
    await save();
    expect(repo.update).toHaveBeenCalledWith(5, expect.not.objectContaining({ kind: expect.anything() }), "additional");
  });

  test("a product from an older server, with no kind, edits as a product", async () => {
    await mount({ id: 6, branch_id: 3, name: "Tea", category: null, price: 300, is_active: true });
    expect(screen.getByText("product.titleEdit")).toBeTruthy();
    await save();
    expect(repo.update).toHaveBeenCalledWith(6, expect.anything(), "regular");
  });
});
