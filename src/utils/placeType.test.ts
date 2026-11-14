import { describe, expect, test } from "vitest";
import { t } from "@/i18n/translations";
import { placeTypeLabelKey } from "./placeType";

/**
 * B6 (audit 2026-11-13): the Active Places cards printed the raw `type`
 * («STANDARD») in ru/am. A place's tier is said through the dictionary, the
 * same words the Prices page uses for the two columns.
 */
describe("placeTypeLabelKey", () => {
  test("each tier has its own word in every language", () => {
    expect(placeTypeLabelKey("standard")).toBe("branch.prices.standard");
    expect(placeTypeLabelKey("vip")).toBe("branch.prices.vip");
    expect(t(placeTypeLabelKey("standard"), "ru")).toBe("Стандарт");
    expect(t(placeTypeLabelKey("standard"), "am")).toBe("Ստանդարտ");
    expect(t(placeTypeLabelKey("vip"), "ru")).toBe("VIP");
  });
});
