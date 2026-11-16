import { describe, expect, test } from "vitest";
import type { IPcApi } from "@/types/sessions";
import { placeLineOf, seatLineOf } from "./seatLine";

/**
 * The one seat line (2026-11-15): the board's card, the bookings calendar and
 * the History place filter all print it. Moved out of SessionsBoard unchanged;
 * the board's own suites (`SessionsBoard.reserve.test.tsx`) pin the same text.
 */

const pc = (over: Partial<IPcApi>): IPcApi => ({
  id: 11, branch_id: 1, label: "PS5-03", status: "online", kind: "ps",
  ...over,
} as IPcApi);

describe("placeLineOf", () => {
  test("number and name", () => {
    expect(placeLineOf({ id: 40, number: 4, name: "Hall VIP" }, "en")).toBe("№4 · Hall VIP");
  });

  test("no name: the number alone", () => {
    expect(placeLineOf({ id: 40, number: 4, name: null }, "en")).toBe("№4");
    expect(placeLineOf({ id: 40, number: 4, name: "   " }, "en")).toBe("№4");
  });

  test("no number: the place id, as the player's phone shows it", () => {
    expect(placeLineOf({ id: 40, number: null, name: "Corner" }, "en")).toBe("№40 · Corner");
  });

  test("the name in the reader's language, falling back like every translated field", () => {
    const place = { id: 40, number: 4, name: "Зал", i18n: { name: { en: "Hall", ru: "Зал", am: null } } };
    expect(placeLineOf(place, "en")).toBe("№4 · Hall");
    expect(placeLineOf(place, "ru")).toBe("№4 · Зал");
    expect(placeLineOf(place, "am")).toBe("№4 · Hall");
  });

  test("the name is trimmed", () => {
    expect(placeLineOf({ id: 40, number: 4, name: "  Hall  " }, "en")).toBe("№4 · Hall");
  });
});

describe("seatLineOf", () => {
  test("a device on a place reads the place's line", () => {
    const device = pc({ place: { id: 40, number: 4, name: "Hall VIP", type: "vip", platform: "ps5" } });
    expect(seatLineOf(device, "en")).toBe("№4 · Hall VIP");
  });

  test("a device with no place reads its own label", () => {
    expect(seatLineOf(pc({ place: null }), "en")).toBe("PS5-03");
    expect(seatLineOf(pc({ place: undefined, label: "PC-9" }), "ru")).toBe("PC-9");
  });
});
