import { describe, expect, test } from "vitest";
import type { IAcceptanceProduct } from "@/types/shifts";
import { filterProducts, stockCountsOf, uncountedIds, venueMoment, venueSpan, withMissing } from "./acceptanceCount";

const p = (product_id: number, name: string, category: string | null = null): IAcceptanceProduct =>
  ({ product_id, name, category, is_active: true });
const cola = p(1, "Cola", "Drinks");
const chips = p(2, "Chips", "Snacks");

describe("the blind count's form", () => {
  test("empty is not counted, 0 is a count, letters are not", () => {
    expect(uncountedIds([cola, chips], {})).toEqual([1, 2]);
    expect(uncountedIds([cola, chips], { 1: "0", 2: "" })).toEqual([2]);
    expect(uncountedIds([cola, chips], { 1: "0", 2: "x" })).toEqual([2]);
    expect(uncountedIds([cola, chips], { 1: "0", 2: "1 200" })).toEqual([]);
  });

  test("the body is every product's whole count, or nothing at all", () => {
    expect(stockCountsOf([cola, chips], { 1: "3" })).toBeNull();
    expect(stockCountsOf([cola, chips], { 1: "3", 2: "0" })).toEqual([{ product_id: 1, counted: 3 }, { product_id: 2, counted: 0 }]);
    expect(stockCountsOf([], {})).toEqual([]);
  });

  test("a 422 adds the products the list did not have", () => {
    const out = withMissing([cola], { code: "stock_count_required", message: "m", missing: [{ product_id: 1, name: "Cola" }, { product_id: 9, name: "Water" }] });
    expect(out.map((x) => x.product_id)).toEqual([1, 9]);
  });

  test("search by name or category", () => {
    expect(filterProducts([cola, chips], "sna").map((x) => x.name)).toEqual(["Chips"]);
    expect(filterProducts([cola, chips], " CO ").map((x) => x.name)).toEqual(["Cola"]);
    expect(filterProducts([cola, chips], "")).toHaveLength(2);
  });
});

describe("venue times", () => {
  test("a span on one day, across midnight, open-ended", () => {
    expect(venueSpan("2026-11-17T10:00:00+04:00", "2026-11-17T12:00:00+04:00")).toBe("17.11 10:00–12:00");
    expect(venueSpan("2026-11-17T22:00:00+04:00", "2026-11-18T02:00:00+04:00")).toBe("17.11 22:00–18.11 02:00");
    expect(venueSpan("2026-11-17T06:00:00Z", null)).toBe("17.11 10:00");
  });

  test("a moment beside the count: time on the same day, else with the day", () => {
    expect(venueMoment("2026-11-18T03:12:00+04:00", "2026-11-18T12:00:00+04:00")).toBe("03:12");
    expect(venueMoment("2026-11-17T23:12:00+04:00", "2026-11-18T12:00:00+04:00")).toBe("17.11 23:12");
  });
});
