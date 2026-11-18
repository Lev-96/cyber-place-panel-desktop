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

  test("a pricing change says both answers in words — no mode (null) is fixed, never «-» (2026-11-17)", () => {
    const withMode = { ...f, pricingMode: (m: string | null) => (m === "hourly" ? "Изменение тарифа" : "Фиксированная цена") };
    expect(describeChange(ev({ action: "pricing_mode_changed", before: { pricing_mode: null }, after: { pricing_mode: "hourly" } }), withMode))
      .toEqual([{ from: "Фиксированная цена", to: "Изменение тарифа" }]);
    expect(describeChange(ev({ action: "pricing_mode_changed", before: { pricing_mode: "hourly" }, after: { pricing_mode: "fixed" } }), withMode))
      .toEqual([{ from: "Изменение тарифа", to: "Фиксированная цена" }]);
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

/** Stock lines (2026-11-16): the server's counts, «5 → 15 (+10)». */
describe("describeChange — stock", () => {
  const fs = { ...f, notCounted: "Без учёта", via: (v: string) => (v === "merge" ? "same name" : v === "create" ? "on create" : null) };

  test("a receipt reads before → after with the change", () => {
    expect(describeChange(ev({ action: "stock_received", before: { stock: 5 }, after: { stock: 15, delta: 10, via: "add" }, old_stock: 5, new_stock: 15, stock_delta: 10 }), fs))
      .toEqual([{ from: "5", to: "15", note: "(+10)" }]);
  });

  test("a create that landed on the product of that name says so", () => {
    expect(describeChange(ev({ action: "stock_received", after: { stock: 15, delta: 10, via: "merge" }, old_stock: 5, new_stock: 15, stock_delta: 10 }), fs))
      .toEqual([{ from: "5", to: "15", note: "(+10) · same name" }]);
  });

  test("a first count and counting off read «Без учёта», without a change in brackets", () => {
    expect(describeChange(ev({ action: "stock_received", after: { stock: 10, delta: 10, via: "create" }, old_stock: null, new_stock: 10, stock_delta: 10 }), fs))
      .toEqual([{ from: "Без учёта", to: "10", note: "on create" }]);
    expect(describeChange(ev({ action: "stock_untracked", old_stock: 6, new_stock: null, stock_delta: -6 }), fs))
      .toEqual([{ from: "6", to: "Без учёта" }]);
  });

  test("a recount below zero uses a real minus sign", () => {
    expect(describeChange(ev({ action: "stock_corrected", old_stock: 2, new_stock: -1, stock_delta: -3 }), fs))
      .toEqual([{ from: "2", to: "−1", note: "(−3)" }]);
  });
});

describe("describeChange — «Быстрая Еда» and the partner (2026-11-18)", () => {
  const ff = {
    ...f,
    fastFood: (on: boolean) => (on ? "Быстрая Еда" : "Не быстрая еда"),
    partner: (id: number | null) => (id === null ? "Свой товар клуба" : id === 7 ? "Pizza House" : `Партнёр №${id}`),
  };

  test("fast food switched on / off reads in words, never true → false", () => {
    expect(describeChange(ev({ action: "fast_food_changed", before: { is_fast_food: false }, after: { is_fast_food: true } }), ff))
      .toEqual([{ from: "Не быстрая еда", to: "Быстрая Еда" }]);
    // A create that set it has no before.
    expect(describeChange(ev({ action: "fast_food_changed", before: null, after: { is_fast_food: true } }), ff))
      .toEqual([{ from: "Не быстрая еда", to: "Быстрая Еда" }]);
  });

  test("the partner reads by name, the club's own by its words, an unknown one by number", () => {
    expect(describeChange(ev({ action: "partner_changed", before: { partner_id: null }, after: { partner_id: 7 } }), ff))
      .toEqual([{ from: "Свой товар клуба", to: "Pizza House" }]);
    expect(describeChange(ev({ action: "partner_changed", before: { partner_id: 7 }, after: { partner_id: 12 } }), ff))
      .toEqual([{ from: "Pizza House", to: "Партнёр №12" }]);
  });
});

