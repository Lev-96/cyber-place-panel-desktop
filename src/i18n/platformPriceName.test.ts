import { describe, expect, it } from "vitest";
import { branchPlatformOptions, customPlatformOptions, platformPriceNameOf } from "./platformPriceName";

const p = (en: string, ru: string, am: string) => ({ name_en: en, name_ru: ru, name_am: am });

describe("platformPriceNameOf", () => {
  it("returns the requested locale when present", () => {
    const price = p("Poker", "Покер", "Պոկեր");
    expect(platformPriceNameOf(price, "en")).toBe("Poker");
    expect(platformPriceNameOf(price, "ru")).toBe("Покер");
    expect(platformPriceNameOf(price, "am")).toBe("Պոկեր");
  });

  it("falls back EN → RU → AM when the requested locale is blank", () => {
    // System is Russian but the name was only entered in Armenian — must still
    // resolve to a non-empty label ("система на русском, имя на армянском").
    expect(platformPriceNameOf(p("", "", "Պոկեր"), "ru")).toBe("Պոկեր");
    expect(platformPriceNameOf(p("Poker", "", ""), "am")).toBe("Poker");
    expect(platformPriceNameOf(p("", "Покер", ""), "en")).toBe("Покер");
  });

  it("returns empty string only when every locale is blank", () => {
    expect(platformPriceNameOf(p("", "", ""), "ru")).toBe("");
  });
});

const row = (platform: string, en: string, ru: string, am: string) => ({ platform, name_en: en, name_ru: ru, name_am: am });

describe("branchPlatformOptions", () => {
  const billiards = row("billiards", "Billiards", "Бильярд", "Բիլիարդ");
  const air = row("air-hockey", "Air hockey", "Аэрохоккей", "Օդային հոկեյ");

  it("known platforms always lead, in canonical order, even with no data", () => {
    expect(branchPlatformOptions([], undefined, "en")).toEqual([
      { slug: "pc", label: "PC", known: true },
      { slug: "ps4", label: "PS4", known: true },
      { slug: "ps5", label: "PS5", known: true },
    ]);
  });

  it("customs from places and price rows, deduplicated, named and sorted in the panel language", () => {
    const opts = branchPlatformOptions(["ps5", "billiards", "table-tennis", "billiards", "", null], [billiards, air], "ru");
    expect(opts.map((o) => o.slug)).toEqual(["pc", "ps4", "ps5", "air-hockey", "billiards", "table-tennis"]);
    expect(opts.slice(3).map((o) => o.label)).toEqual(["Аэрохоккей", "Бильярд", "Table Tennis"]);
    expect(opts.slice(3).every((o) => !o.known)).toBe(true);
  });

  it("a price row adds its platform even when no place uses it yet", () => {
    expect(branchPlatformOptions([], [billiards], "am").map((o) => o.label)).toContain("Բիլիարդ");
  });

  it("extra keeps a saved slug the branch no longer has, de-slugged", () => {
    const opts = branchPlatformOptions([], [], "en", "old-room");
    expect(opts[opts.length - 1]).toEqual({ slug: "old-room", label: "Old Room", known: false });
    expect(branchPlatformOptions([], [], "en", "ps4")).toHaveLength(3);
  });

  it("never invents a console slug that no data names", () => {
    const slugs = branchPlatformOptions(["billiards"], [], "en").map((o) => o.slug);
    expect(slugs.filter((s) => /^ps/.test(s))).toEqual(["ps4", "ps5"]);
  });
});

describe("customPlatformOptions (filter over the same list)", () => {
  it("only the given slugs, named by the price rows, known ones dropped", () => {
    const prices = [row("billiards", "Billiards", "Бильярд", ""), row("poker", "Poker", "Покер", "")];
    expect(customPlatformOptions(["pc", "billiards"], prices, "ru")).toEqual([{ slug: "billiards", label: "Бильярд" }]);
  });
});
