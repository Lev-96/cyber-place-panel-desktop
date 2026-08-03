import { describe, expect, test } from "vitest";
import { IBranchSubplatform } from "@/types/api";
import { MAX_NAMED_TABS, hiddenSubplatforms, visibleSubplatformTabs } from "@/utils/subplatformTabs";

/**
 * Which subplatforms get a tab.
 *
 * The specification, as tests: at most Default + two most-used + Other, the
 * server's order is respected rather than re-sorted, and the current selection
 * always keeps a tab — the last of which is the rule that stops an edit form
 * from opening with nothing selected.
 */

let nextId = 1;

const sub = (
  name: string,
  places: number,
  isDefault = false,
): IBranchSubplatform => ({
  id: nextId++,
  branch_id: 1,
  platform: "ps5",
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  name_en: name,
  name_ru: name,
  name_am: name,
  name,
  price_standard: null,
  price_vip: null,
  is_default: isDefault,
  places_count: places,
});

/** Server order: default first, then by places_count desc. */
const catalogue = () => {
  nextId = 1;
  return [
    sub("Default", 0, true),
    sub("Big screen", 9),
    sub("VR", 5),
    sub("Racing seat", 3),
    sub("Sofa", 1),
  ];
};

describe("the tab strip stays a strip", () => {
  test("everything is shown while it still fits", () => {
    const all = catalogue().slice(0, MAX_NAMED_TABS);

    expect(visibleSubplatformTabs(all, null)).toHaveLength(MAX_NAMED_TABS);
  });

  test("a longer catalogue is cut to Default plus the two most used", () => {
    const all = catalogue();

    const names = visibleSubplatformTabs(all, null).map((s) => s.name_en);

    // Anything more would wrap in the place modal, and a tab strip that grows
    // with the catalogue has stopped being a tab strip.
    expect(names).toEqual(["Default", "Big screen", "VR"]);
  });

  test("the rest are reachable through Other, and only there", () => {
    const all = catalogue();
    const visible = visibleSubplatformTabs(all, null);

    const hidden = hiddenSubplatforms(all, visible).map((s) => s.name_en);

    // A subplatform that is both a tab and an Other entry could be selected two
    // ways and would read as a duplicate.
    expect(hidden).toEqual(["Racing seat", "Sofa"]);
  });
});

describe("the current selection always has a tab", () => {
  test("selecting a hidden subplatform gives it the last named slot", () => {
    const all = catalogue();
    const sofa = all.find((s) => s.name_en === "Sofa")!;

    const names = visibleSubplatformTabs(all, sofa.id).map((s) => s.name_en);

    // Editing a place on the fifth-most-used subplatform must not open a form
    // where nothing looks selected and the real value hides behind Other.
    expect(names).toEqual(["Default", "Big screen", "Sofa"]);
  });

  test("Default keeps its slot even then", () => {
    const all = catalogue();
    const sofa = all.find((s) => s.name_en === "Sofa")!;

    expect(visibleSubplatformTabs(all, sofa.id)[0].is_default).toBe(true);
  });

  test("selecting a visible subplatform changes nothing", () => {
    const all = catalogue();
    const vr = all.find((s) => s.name_en === "VR")!;

    expect(visibleSubplatformTabs(all, vr.id).map((s) => s.name_en))
      .toEqual(["Default", "Big screen", "VR"]);
  });

  test("an unknown selection is ignored rather than blanking a tab", () => {
    const all = catalogue();

    expect(visibleSubplatformTabs(all, 9999).map((s) => s.name_en))
      .toEqual(["Default", "Big screen", "VR"]);
  });
});

describe("ordering", () => {
  test("Default leads even when the server did not put it first", () => {
    nextId = 1;
    const all = [sub("VR", 5), sub("Default", 0, true), sub("Big screen", 9), sub("Sofa", 1)];

    expect(visibleSubplatformTabs(all, null)[0].name_en).toBe("Default");
  });

  test("equal usage does not reshuffle between renders", () => {
    nextId = 1;
    const all = [sub("Default", 0, true), sub("A", 4), sub("B", 4), sub("C", 4)];

    // Re-sorting on a tie would make the tabs swap places between requests.
    const once = visibleSubplatformTabs(all, null).map((s) => s.name_en);
    const twice = visibleSubplatformTabs(all, null).map((s) => s.name_en);

    expect(once).toEqual(["Default", "A", "B"]);
    expect(twice).toEqual(once);
  });

  test("a catalogue with no default still fills the strip", () => {
    nextId = 1;
    const all = [sub("A", 4), sub("B", 3), sub("C", 2), sub("D", 1)];

    expect(visibleSubplatformTabs(all, null).map((s) => s.name_en)).toEqual(["A", "B", "C"]);
  });
});
