import { describe, expect, test } from "vitest";
import {
  OUTSIDE_FOOD_FEE_MAX,
  changedPlaceFees,
  defaultPlacesTab,
  draftOf,
  feeStateOf,
  groupByPlatform,
  inTab,
  matchesSearch,
  parsePlaceFee,
  placeFeesFingerprint,
  placesSummary,
  tabCounts,
  type FeePlace,
} from "./outsideFoodPlaces";

/**
 * The per-place «Свои продукты» list on the Prices page (2026-11-14, owner):
 * a place's own figure lives on the place (`places.outside_food_fee`), null =
 * like the branch's tier, 0 = not charged at this place. Only the rows the
 * owner changed travel with the Save.
 */

const place = (id: number, over: Partial<FeePlace> = {}): FeePlace => ({
  id, number: id, name: null, type: "standard", platform: "pc", status: "active", outside_food_fee: null, ...over,
});

describe("one box", () => {
  test("empty = like the branch (null); 0 = not charged; a figure; anything else NaN", () => {
    expect(parsePlaceFee("")).toBeNull();
    expect(parsePlaceFee("  ")).toBeNull();
    expect(parsePlaceFee("0")).toBe(0);
    expect(parsePlaceFee("1500")).toBe(1500);
    expect(parsePlaceFee("abc")).toBeNaN();
    expect(parsePlaceFee("-5")).toBeNaN();
    expect(parsePlaceFee(String(OUTSIDE_FOOD_FEE_MAX))).toBe(OUTSIDE_FOOD_FEE_MAX);
    expect(parsePlaceFee(String(OUTSIDE_FOOD_FEE_MAX + 1))).toBeNaN();
  });

  test("the stored figure as the box holds it", () => {
    expect(draftOf(null)).toBe("");
    expect(draftOf(undefined)).toBe("");
    expect(draftOf(0)).toBe("0");
    expect(draftOf(1500)).toBe("1500");
  });

  test("state of a fee", () => {
    expect(feeStateOf(null)).toBe("branch");
    expect(feeStateOf(0)).toBe("notCharged");
    expect(feeStateOf(700)).toBe("own");
    expect(feeStateOf(NaN)).toBe("invalid");
  });
});

describe("what a Save sends", () => {
  const places = [place(1), place(2, { outside_food_fee: 1500 }), place(3, { outside_food_fee: 0 }), place(4)];

  test("only the changed rows, each as number / 0 / null", () => {
    const rows = changedPlaceFees(places, { 1: "2000", 2: "", 3: "0", 4: "0" });
    expect(rows).toEqual([
      { place_id: 1, fee: 2000 },
      { place_id: 2, fee: null },
      { place_id: 4, fee: 0 },
    ]);
  });

  test("a box typed back to the stored value is not a change", () => {
    expect(changedPlaceFees(places, { 2: "1500", 1: "" })).toEqual([]);
  });

  test("an invalid box is never sent", () => {
    expect(changedPlaceFees(places, { 1: "abc" })).toEqual([]);
  });

  test("an older backend (no field) reads as like the branch", () => {
    const old = [{ ...place(5), outside_food_fee: undefined }];
    expect(changedPlaceFees(old, {})).toEqual([]);
    expect(changedPlaceFees(old, { 5: "0" })).toEqual([{ place_id: 5, fee: 0 }]);
  });
});

describe("tabs", () => {
  const places = [
    place(1, { type: "vip", outside_food_fee: 2000 }),
    place(2, { type: "vip" }),
    place(3, { outside_food_fee: 0 }),
    place(4),
  ];

  test("counts: all, vip, standard, with an own setting (a figure or 0)", () => {
    expect(tabCounts(places, {})).toEqual({ all: 4, vip: 2, standard: 2, own: 2 });
  });

  test("a row being edited stays in «own» while its box is cleared", () => {
    expect(inTab(places[0], "own", { 1: "" })).toBe(true);
    expect(inTab(places[3], "own", { 4: "900" })).toBe(true);
    expect(inTab(places[3], "own", {})).toBe(false);
  });

  test("the default is «own» when any place has its own setting, otherwise «all»", () => {
    expect(defaultPlacesTab(places)).toBe("own");
    expect(defaultPlacesTab([place(1), place(2)])).toBe("all");
    expect(defaultPlacesTab([place(1, { outside_food_fee: 0 })])).toBe("own");
  });
});

describe("search", () => {
  const p = place(12, { name: "Corner VIP" });
  test("by number (with or without №), or by name, case-insensitive", () => {
    expect(matchesSearch(p, "")).toBe(true);
    expect(matchesSearch(p, "12")).toBe(true);
    expect(matchesSearch(p, "1")).toBe(true);
    expect(matchesSearch(p, "№12")).toBe(true);
    expect(matchesSearch(p, "13")).toBe(false);
    expect(matchesSearch(p, "corner")).toBe(true);
    expect(matchesSearch(p, "hall")).toBe(false);
  });
});

describe("groups", () => {
  test("by platform, each sorted by number; groups in the order of their first place", () => {
    const groups = groupByPlatform([
      place(9, { platform: "ps5" }), place(3), place(1), place(2, { platform: "ps5" }), place(20, { platform: "billiard" }),
    ]);
    expect(groups.map((g) => [g.platform, g.places.map((x) => x.id)])).toEqual([
      ["pc", [1, 3]],
      ["ps5", [2, 9]],
      ["billiard", [20]],
    ]);
  });
});

describe("summary over ALL places", () => {
  test("own / not charged / like the branch, after the edits; pending = changed rows", () => {
    const places = [place(1, { outside_food_fee: 1500 }), place(2), place(3), place(4, { outside_food_fee: 0 })];
    expect(placesSummary(places, {})).toEqual({ own: 1, notCharged: 1, branch: 2, pending: 0, invalid: 0 });
    expect(placesSummary(places, { 2: "0", 3: "800", 1: "" })).toEqual({ own: 1, notCharged: 2, branch: 1, pending: 3, invalid: 0 });
    expect(placesSummary(places, { 2: "abc" }).invalid).toBe(1);
  });
});

describe("the form's key on the page", () => {
  test("changes when any place's fee changes, and differs between not loaded and empty", () => {
    const a = placeFeesFingerprint([place(1), place(2, { outside_food_fee: 5 })]);
    expect(placeFeesFingerprint([place(1), place(2, { outside_food_fee: 6 })])).not.toBe(a);
    expect(placeFeesFingerprint([place(1), place(2, { outside_food_fee: 0 })])).not.toBe(
      placeFeesFingerprint([place(1), place(2, { outside_food_fee: null })]),
    );
    expect(placeFeesFingerprint(null)).not.toBe(placeFeesFingerprint([]));
  });
});
