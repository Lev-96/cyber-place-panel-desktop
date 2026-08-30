import { describe, expect, test } from "vitest";
import { IBranchSubplatform } from "@/types/api";
import { matchSubplatforms } from "@/components/ui/SubplatformNameInput";

/**
 * Matching in the "Other" field.
 *
 * This is what decides whether the operator is PICKING an existing subcategory
 * or CREATING a new one — the two extra language fields appear only when
 * nothing matches. Get it wrong in one direction and they cannot reach a
 * subcategory that exists; wrong in the other and the create fields never show.
 */

let nextId = 1;

const sub = (en: string, ru: string, am: string): IBranchSubplatform => ({
  id: nextId++,
  branch_id: 1,
  platform: "ps5",
  slug: en.toLowerCase().replace(/\s+/g, "-"),
  name_en: en,
  name_ru: ru,
  name_am: am,
  name: en,
  price_standard: null,
  price_vip: null,
  is_default: false,
  places_count: 0,
});

const catalogue = () => {
  nextId = 1;
  return [
    sub("Big screen", "Большой экран", "Մեծ էկրան"),
    sub("VR", "VR", "VR"),
  ];
};

describe("finding an existing subcategory", () => {
  test("an empty query matches nothing", () => {
    // Otherwise every subcategory would count as a match and the create fields
    // could never appear.
    expect(matchSubplatforms(catalogue(), "")).toEqual([]);
    expect(matchSubplatforms(catalogue(), "   ")).toEqual([]);
  });

  test("it matches on a partial name", () => {
    expect(matchSubplatforms(catalogue(), "big").map((s) => s.name_en)).toEqual(["Big screen"]);
  });

  test("case does not matter", () => {
    expect(matchSubplatforms(catalogue(), "BIG SCREEN")).toHaveLength(1);
  });

  test("it matches a name written in ANY language", () => {
    // The operator types in their own language; the subcategory may have been
    // created in another. Matching only English would hide it and let them
    // create a duplicate.
    expect(matchSubplatforms(catalogue(), "Большой").map((s) => s.name_en)).toEqual(["Big screen"]);
    expect(matchSubplatforms(catalogue(), "Մեծ").map((s) => s.name_en)).toEqual(["Big screen"]);
  });

  test("an unknown name matches nothing — that is the signal to create", () => {
    expect(matchSubplatforms(catalogue(), "Racing seat")).toEqual([]);
  });

  test("an absent catalogue is not an error", () => {
    expect(matchSubplatforms(undefined, "vr")).toEqual([]);
  });
});
