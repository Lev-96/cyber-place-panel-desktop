import { describe, expect, it } from "vitest";
import { matchPlatforms, resolveTypedPlatform, sanitizeForLang } from "./platformName";
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

/**
 * A name typed under "Other" that IS an existing platform selects it instead
 * of forking a duplicate (2026-10-11).
 */
describe("resolveTypedPlatform", () => {
  const names = (en: string, ru = "", am = "") => ({ en, ru, am });
  const poker = price({ id: 2, platform: "poker", name_en: "Poker", name_ru: POKER_RU, name_am: POKER_AM });
  // A priced platform whose name is not its slug: only a name match finds it.
  const pool = price({ id: 3, platform: "billiards", name_en: "Pool table", name_ru: "Бильярд", name_am: "" });
  const existing = ["poker", "billiards", "poker2"];

  it("a known platform's name, any case, trimmed", () => {
    for (const typed of ["PC", "pc", "Pc", " PC ", "PS5"]) {
      expect(resolveTypedPlatform(names(typed), "en", existing, [poker])).toBe(typed.trim().toLowerCase());
    }
  });

  it("a custom platform by its slug, including one no price row names", () => {
    expect(resolveTypedPlatform(names("POKER"), "en", existing, [poker])).toBe("poker");
    expect(resolveTypedPlatform(names("Poker2"), "en", existing, [poker])).toBe("poker2");
  });

  it("a custom platform by its name in the box the operator types in", () => {
    expect(resolveTypedPlatform(names("Pool Table"), "en", existing, [pool])).toBe("billiards");
    expect(resolveTypedPlatform(names("", " бильярд "), "ru", existing, [pool])).toBe("billiards");
    // The known three are named in Latin in every language.
    expect(resolveTypedPlatform(names("", "PC"), "ru", existing, [])).toBe("pc");
  });

  it("a new name stays a new platform, slugged as before", () => {
    expect(resolveTypedPlatform(names("Steam Deck"), "en", existing, [poker])).toBe("steam-deck");
    expect(resolveTypedPlatform(names(""), "en", existing, [poker])).toBe("");
  });

  it("never a partial match", () => {
    expect(resolveTypedPlatform(names("PS"), "en", existing, [poker])).toBe("ps");
    expect(resolveTypedPlatform(names("Poke"), "en", existing, [poker])).toBe("poke");
    expect(resolveTypedPlatform(names("", "Бильяр"), "ru", existing, [pool])).toBe("");
  });

  it("a machine-translated box never re-targets: only the typed box is matched by name", () => {
    // Typed "Snooker" in English; the Russian box was filled with "Бильярд".
    expect(resolveTypedPlatform(names("Snooker", "Бильярд"), "en", existing, [pool])).toBe("snooker");
  });

  it("two platforms answering to the same name are ambiguous: neither is chosen", () => {
    const pool2 = price({ id: 4, platform: "pool", name_en: "Pool", name_ru: "Бильярд", name_am: "" });
    expect(resolveTypedPlatform(names("", "Бильярд"), "ru", [...existing, "pool"], [pool, pool2])).toBe("");
  });

  it("no branch data yet (loading or failed): only the known three and the derived slug", () => {
    expect(resolveTypedPlatform(names("Pool Table"), "en", [], undefined)).toBe("pool-table");
    expect(resolveTypedPlatform(names("PC"), "en", [], undefined)).toBe("pc");
  });
});
