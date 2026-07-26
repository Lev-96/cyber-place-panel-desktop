import { describe, expect, it } from "vitest";
import { platformPriceNameOf } from "./platformPriceName";

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
