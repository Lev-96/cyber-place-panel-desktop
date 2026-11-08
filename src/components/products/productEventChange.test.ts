import { describe, expect, test } from "vitest";
import type { IProductEvent } from "@/types/productEvents";
import { describeChange } from "./productEventChange";

/**
 * What a product-history row says changed (2026-11-09). Read off the server's
 * row as recorded — the old and new price are its decimal strings, formatted
 * here and never recomputed.
 */
const f = { price: (a: string) => `${Number(a)} ֏`, kind: (k: string) => `kind:${k}` };

const ev = (over: Partial<IProductEvent>): IProductEvent => ({
  id: 1, action: "renamed", product_id: 7, product_name: "Tea", branch_id: 3, branch_name: "Abovyan 1",
  actor: { id: 10, name: "Anna", role: "manager" }, before: null, after: null, old_price: null, new_price: null,
  created_at: "2026-11-09T10:00:00+04:00", ...over,
});

describe("describeChange", () => {
  test("a price change reads old → new from the server's prices", () => {
    expect(describeChange(ev({ action: "price_changed", old_price: "300.00", new_price: "350.00" }), f))
      .toEqual([{ from: "300 ֏", to: "350 ֏" }]);
  });

  test("a first price has no old one", () => {
    expect(describeChange(ev({ action: "price_set", old_price: null, new_price: "500.00" }), f))
      .toEqual([{ from: "-", to: "500 ֏" }]);
  });

  test("a rename reads before → after of the one field", () => {
    expect(describeChange(ev({ action: "renamed", before: { name: "Tea" }, after: { name: "Green tea" } }), f))
      .toEqual([{ from: "Tea", to: "Green tea" }]);
  });

  test("a kind change says the kind in words; an empty category is «-»", () => {
    expect(describeChange(ev({ action: "kind_changed", before: { kind: "regular" }, after: { kind: "additional" } }), f))
      .toEqual([{ from: "kind:regular", to: "kind:additional" }]);
    expect(describeChange(ev({ action: "category_changed", before: { category: null }, after: { category: "Drinks" } }), f))
      .toEqual([{ from: "-", to: "Drinks" }]);
  });

  test("several fields name each one; unchanged fields are left out", () => {
    expect(describeChange(ev({
      action: "translation_changed",
      before: { "name.ru": "Чай", "name.am": "Թեյ", "category.ru": "Напитки" },
      after: { "name.ru": "Зелёный чай", "name.am": "Կանաչ թեյ", "category.ru": "Напитки" },
    }), f)).toEqual([
      { field: "name.ru", from: "Чай", to: "Зелёный чай" },
      { field: "name.am", from: "Թեյ", to: "Կանաչ թեյ" },
    ]);
  });

  test("created / deleted / activated / deactivated are said by their label alone", () => {
    for (const action of ["created", "deleted", "activated", "deactivated"] as const) {
      expect(describeChange(ev({ action, before: { is_active: false }, after: { is_active: true } }), f)).toEqual([]);
    }
  });
});
