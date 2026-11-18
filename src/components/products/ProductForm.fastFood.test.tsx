// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IPartner } from "@/api/partners";
import type { IProduct } from "@/types/pos";
import ProductForm from "./ProductForm";

/**
 * «Быстрая Еда» on the product form (2026-11-18, owner). A regular product
 * gets a switch; with the partner list (owner, admin: `partners.manage`) a
 * «Чей товар» select, «Свой товар клуба» = none. The save carries the keys
 * exactly as the backend expects: only what changed, `partner_id` only from
 * someone with the list, and switching fast food off removes the partner in
 * the same save (the server refuses the reverse).
 */

const repo = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), createCounted: vi.fn() }));
vi.mock("@/repositories/ProductRepository", () => ({
  productRepository: {
    create: (...a: unknown[]) => repo.create(...a),
    update: (...a: unknown[]) => repo.update(...a),
    createCounted: (...a: unknown[]) => repo.createCounted(...a),
  },
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

const partner = (id: number, name: string, over: Partial<IPartner> = {}): IPartner => ({
  id, company_id: 1, name, phone: null, note: null, terms: "percent", percent: "10.00", fixed_amount: null,
  active: true, archived: false, archived_at: null, ...over,
});
const PARTNERS = [partner(7, "Pizza House"), partner(8, "Old Grill", { archived: true }), partner(9, "Paused", { active: false })];

const product = (over: Partial<IProduct> = {}): IProduct => ({
  id: 5, branch_id: 3, name: "Burger", category: null, price: 1500, is_active: true, kind: "regular", ...over,
});

const mount = async (props: { initial?: IProduct; kind?: "regular" | "additional"; fastFood?: boolean; partners?: IPartner[] | null }) => {
  await act(async () => { render(<ProductForm branchId={3} onClose={() => {}} onSaved={() => {}} {...props} />); });
};
const fill = async (name: string, price: string) => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("label.name"), { target: { value: name } });
    fireEvent.change(screen.getByLabelText("label.price"), { target: { value: price } });
  });
};
const toggleFastFood = async () => { await act(async () => { fireEvent.click(screen.getByRole("switch")); }); };
const pickPartner = async (value: string) => {
  await act(async () => { fireEvent.change(screen.getByTestId("product-partner"), { target: { value } }); });
};
const save = async () => { await act(async () => { fireEvent.click(screen.getByText("action.save")); }); };
const body = (fn: ReturnType<typeof vi.fn>, at = 0) => fn.mock.calls[0][at] as Record<string, unknown>;

beforeEach(() => {
  for (const f of [repo.create, repo.update, repo.createCounted]) f.mockReset();
  repo.create.mockResolvedValue({ id: 5 });
  repo.update.mockResolvedValue({ id: 5 });
});
afterEach(() => cleanup());

describe("ProductForm — «Быстрая Еда»", () => {
  test("an ordinary new product: switch off, and the create carries neither key (the request it always was)", async () => {
    await mount({ partners: PARTNERS });
    expect((screen.getByRole("switch") as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByTestId("product-partner")).toBeNull();
    await fill("Tea", "300");
    await save();
    expect(body(repo.create)).not.toHaveProperty("is_fast_food");
    expect(body(repo.create)).not.toHaveProperty("partner_id");
  });

  test("created from the fast-food tab: on, own product → is_fast_food only", async () => {
    await mount({ fastFood: true, partners: PARTNERS });
    expect((screen.getByRole("switch") as HTMLInputElement).checked).toBe(true);
    await fill("Hot dog", "900");
    await save();
    expect(body(repo.create)).toMatchObject({ is_fast_food: true, kind: "regular" });
    expect(body(repo.create)).not.toHaveProperty("partner_id");
  });

  test("the owner picks a partner: only active, not archived ones are offered, after «Свой товар клуба»", async () => {
    await mount({ fastFood: true, partners: PARTNERS });
    const options = [...(screen.getByTestId("product-partner") as HTMLSelectElement).options].map((o) => [o.value, o.textContent]);
    expect(options).toEqual([["", "product.partnerOwn"], ["7", "Pizza House"]]);
    await fill("Pizza", "2500");
    await pickPartner("7");
    await save();
    expect(body(repo.create)).toMatchObject({ is_fast_food: true, partner_id: 7 });
  });

  test("without the partner list (a manager) there is no partner field and partner_id is never sent", async () => {
    await mount({ fastFood: true });
    expect(screen.queryByTestId("product-partner")).toBeNull();
    await fill("Fries", "700");
    await save();
    expect(body(repo.create)).toMatchObject({ is_fast_food: true });
    expect(body(repo.create)).not.toHaveProperty("partner_id");
  });

  test("an additional item has no fast-food switch", async () => {
    await mount({ kind: "additional", partners: PARTNERS });
    expect(screen.queryByRole("switch")).toBeNull();
  });

  test("editing without touching it: neither key is sent", async () => {
    await mount({ initial: product({ is_fast_food: true, partner_id: 7 }), partners: PARTNERS });
    await save();
    expect(body(repo.update, 1)).not.toHaveProperty("is_fast_food");
    expect(body(repo.update, 1)).not.toHaveProperty("partner_id");
  });

  test("the owner switches a partner's product off: fast food AND the partner go in the same save", async () => {
    await mount({ initial: product({ is_fast_food: true, partner_id: 7 }), partners: PARTNERS });
    await toggleFastFood();
    expect(screen.queryByTestId("product-partner")).toBeNull();
    await save();
    expect(body(repo.update, 1)).toMatchObject({ is_fast_food: false, partner_id: null });
  });

  test("the owner moves a product to the club's own: partner_id null, is_fast_food untouched", async () => {
    await mount({ initial: product({ is_fast_food: true, partner_id: 7 }), partners: PARTNERS });
    await pickPartner("");
    await save();
    expect(body(repo.update, 1)).toMatchObject({ partner_id: null });
    expect(body(repo.update, 1)).not.toHaveProperty("is_fast_food");
  });

  test("a product whose partner was archived still shows them, marked, and keeps them unsent", async () => {
    await mount({ initial: product({ is_fast_food: true, partner_id: 8 }), partners: PARTNERS });
    const select = screen.getByTestId("product-partner") as HTMLSelectElement;
    expect(select.value).toBe("8");
    expect([...select.options].map((o) => o.textContent)).toContain("product.partnerArchived");
    await save();
    expect(body(repo.update, 1)).not.toHaveProperty("partner_id");
  });

  test("a manager editing a partner's product: the switch is locked on, and the save carries no partner", async () => {
    await mount({ initial: product({ is_fast_food: true, partner_id: 7 }) });
    expect((screen.getByRole("switch") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("product.fastFoodLocked")).toBeTruthy();
    await save();
    expect(body(repo.update, 1)).not.toHaveProperty("partner_id");
    expect(body(repo.update, 1)).not.toHaveProperty("is_fast_food");
  });

  test("a manager may switch the club's own fast food off", async () => {
    await mount({ initial: product({ is_fast_food: true, partner_id: null }) });
    expect((screen.getByRole("switch") as HTMLInputElement).disabled).toBe(false);
    await toggleFastFood();
    await save();
    expect(body(repo.update, 1)).toMatchObject({ is_fast_food: false });
    expect(body(repo.update, 1)).not.toHaveProperty("partner_id");
  });

  test("a counted new fast food carries the flag with its quantity", async () => {
    repo.createCounted.mockResolvedValue({ product: { id: 9, stock: 5 } });
    await mount({ fastFood: true, partners: PARTNERS });
    await fill("Nuggets", "1100");
    await act(async () => { fireEvent.change(screen.getByTestId("product-quantity"), { target: { value: "5" } }); });
    await pickPartner("7");
    await save();
    expect(body(repo.createCounted)).toMatchObject({ stock: 5, is_fast_food: true, partner_id: 7 });
  });
});
