// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IProduct } from "@/types/pos";
import ProductForm from "./ProductForm";

/**
 * A product's picture (2026-11-25): sent after the product is saved, on its
 * own endpoint; a picture that fails never loses the product.
 */
const repo = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), setImage: vi.fn(), removeImage: vi.fn() }));
const toast = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock("@/repositories/ProductRepository", () => ({ productRepository: repo }));
vi.mock("@/ui/notify", async (orig) => {
  const real = await orig<typeof import("@/ui/notify")>();
  return { ...real, notify: { ...real.notify, warning: (...a: unknown[]) => toast.warning(...a) } };
});
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
vi.mock("@/components/ui/ImageUpload", () => ({
  default: ({ onChange }: { onChange: (f: File | null) => void }) => (
    <button type="button" data-testid="pick-picture" onClick={() => onChange(new File(["x"], "cola.png", { type: "image/png" }))}>pick</button>
  ),
}));

const PNG = expect.objectContaining({ name: "cola.png" });
const mount = async (initial?: IProduct) => {
  const onSaved = vi.fn();
  await act(async () => { render(<ProductForm branchId={3} initial={initial} onClose={() => {}} onSaved={onSaved} />); });
  return { onSaved };
};
const save = async () => { await act(async () => { fireEvent.click(screen.getByText("action.save")); }); };

beforeEach(() => {
  for (const f of Object.values(repo)) f.mockReset();
  toast.warning.mockReset();
  repo.create.mockResolvedValue({ id: 5 });
  repo.update.mockResolvedValue({ id: 5 });
  repo.setImage.mockResolvedValue({ id: 5, image_path: "images/products/a.png" });
  repo.removeImage.mockResolvedValue({ id: 5, image_path: null });
});
afterEach(cleanup);

describe("ProductForm — the picture", () => {
  test("a new product with a picture: saved first, then the picture on its id", async () => {
    const { onSaved } = await mount();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("label.name"), { target: { value: "Cola" } });
      fireEvent.change(screen.getByLabelText("label.price"), { target: { value: "500" } });
      fireEvent.click(screen.getByTestId("pick-picture"));
    });
    await save();
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.setImage).toHaveBeenCalledWith(5, PNG);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ image_path: "images/products/a.png" }));
  });

  test("no picture picked: no picture call at all", async () => {
    await mount({ id: 5, branch_id: 3, name: "Cola", price: 500, is_active: true, kind: "regular" } as IProduct);
    await save();
    expect(repo.update).toHaveBeenCalled();
    expect(repo.setImage).not.toHaveBeenCalled();
    expect(repo.removeImage).not.toHaveBeenCalled();
  });

  test("the picture fails: the product is still saved, and the cashier is told", async () => {
    repo.setImage.mockRejectedValue(new Error("413"));
    const { onSaved } = await mount({ id: 5, branch_id: 3, name: "Cola", price: 500, is_active: true, kind: "regular" } as IProduct);
    await act(async () => { fireEvent.click(screen.getByTestId("pick-picture")); });
    await save();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
    expect(toast.warning).toHaveBeenCalledWith("product.imageFailed");
  });

  test("«Убрать картинку» removes it after the save", async () => {
    await mount({ id: 5, branch_id: 3, name: "Cola", price: 500, is_active: true, kind: "regular", image_path: "images/products/old.png" } as IProduct);
    await act(async () => { fireEvent.click(screen.getByTestId("product-image-remove")); });
    await save();
    expect(repo.removeImage).toHaveBeenCalledWith(5);
  });

  test("an additional item (a cue) has no picture field", async () => {
    await act(async () => { render(<ProductForm branchId={3} kind="additional" onClose={() => {}} onSaved={vi.fn()} />); });
    expect(screen.queryByTestId("product-image")).toBeNull();
  });
});
