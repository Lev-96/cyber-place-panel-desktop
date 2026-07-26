import { describe, expect, it } from "vitest";
import { matchPlatforms, sanitizeForLang } from "./platformName";
import { IBranchPlatformPrice } from "@/types/api";

// Exact code points so homoglyphs can't muddy the test.
const TENNIS_RU = "Теннис"; // Теннис (Cyrillic)
const TENNIS_AM = "Թենիս"; // Թենիս (Armenian)
const POKER_RU = "Покер"; // Покер (Cyrillic)
const POKER_AM = "Պոկեր"; // Պոկեր (Armenian)

const price = (over: Partial<IBranchPlatformPrice>): IBranchPlatformPrice => ({
  id: 1, branch_id: 1, platform: "tennis", name_en: "Tennis", name_ru: TENNIS_RU, name_am: TENNIS_AM,
  name: "Tennis", price_standard: 100, price_vip: null, ...over,
});

describe("sanitizeForLang", () => {
  it("keeps only Latin (+ digits/space) in the English field", () => {
    expect(sanitizeForLang("en", "PS4 New")).toBe("PS4 New");
    expect(sanitizeForLang("en", TENNIS_RU)).toBe(""); // Cyrillic blocked
    expect(sanitizeForLang("en", "Po" + TENNIS_RU + TENNIS_AM)).toBe("Po"); // strips Cyrillic + Armenian
  });

  it("blocks Armenian in the Russian field but keeps Cyrillic/Latin/digits", () => {
    expect(sanitizeForLang("ru", TENNIS_RU + " PS4")).toBe(TENNIS_RU + " PS4");
    expect(sanitizeForLang("ru", TENNIS_RU + TENNIS_AM)).toBe(TENNIS_RU);
  });

  it("blocks Cyrillic (Russian) in the Armenian field", () => {
    expect(sanitizeForLang("am", TENNIS_AM)).toBe(TENNIS_AM);
    expect(sanitizeForLang("am", TENNIS_AM + TENNIS_RU)).toBe(TENNIS_AM); // strips Cyrillic
  });
});

describe("matchPlatforms", () => {
  const list = [
    price({ id: 1, platform: "tennis" }),
    price({ id: 2, platform: "poker", name_en: "Poker", name_ru: POKER_RU, name_am: POKER_AM }),
  ];

  it("matches on the first letter, any case, from any locale", () => {
    // "Т"/"т" (Cyrillic) → Теннис, no matter which input the query came from.
    expect(matchPlatforms(list, "Т").map((p) => p.platform)).toEqual(["tennis"]); // Т
    expect(matchPlatforms(list, "т").map((p) => p.platform)).toEqual(["tennis"]); // т
    // Latin query hits the English locale of the same platform.
    expect(matchPlatforms(list, "ten").map((p) => p.platform)).toEqual(["tennis"]);
    // Armenian query hits the Armenian locale.
    expect(matchPlatforms(list, "Պ").map((p) => p.platform)).toEqual(["poker"]); // Պ
  });

  it("returns nothing for a blank query and dedupes by platform", () => {
    expect(matchPlatforms(list, "   ")).toEqual([]);
    const dup = [price({ id: 1, platform: "tennis" }), price({ id: 3, platform: "tennis" })];
    expect(matchPlatforms(dup, "ten")).toHaveLength(1);
  });
});
