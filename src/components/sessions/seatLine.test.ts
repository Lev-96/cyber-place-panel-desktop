import { describe, expect, test } from "vitest";
import type { IPcApi } from "@/types/sessions";
import { numberNameLine, placeLineOf, seatLineOf, seatLineWithKind, sessionSeatLine } from "./seatLine";
import { dialogToneClass } from "@/components/ui/dialogTone";

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

describe("numberNameLine (2026-11-22: every surface names a seat this way)", () => {
  test("number and name; a name that only repeats the number is dropped", () => {
    expect(numberNameLine(4, "Hall VIP")).toBe("№4 · Hall VIP");
    expect(numberNameLine(4, "  Hall  ")).toBe("№4 · Hall");
    expect(numberNameLine(4, null)).toBe("№4");
    expect(numberNameLine(4, "4")).toBe("№4");
    expect(numberNameLine(4, "№4")).toBe("№4");
  });
});

describe("sessionSeatLine", () => {
  test("a row read with its place's number: the place line", () => {
    expect(sessionSeatLine({ pc_id: 3, pc_label: "PS-3", pc: { id: 3, place: { id: 40, number: 4, name: "Sofa" } } }, "en")).toBe("№4 · Sofa");
    expect(sessionSeatLine({ pc_id: 3, pc_label: "PS-3", pc: { id: 3, place: { id: 40, number: null, name: "Sofa" } } }, "en")).toBe("№40 · Sofa");
  });

  test("the board's listing has no `number` on its place: never its id as a number — the label", () => {
    expect(sessionSeatLine({ pc_id: 3, pc_label: "PS-3", pc: { id: 3, place: { id: 40 } } }, "en")).toBe("PS-3");
    expect(sessionSeatLine({ pc_id: 3, pc_label: "PS-3" }, "en")).toBe("PS-3");
    expect(sessionSeatLine({ pc_id: 3, pc_label: "" }, "en")).toBe("#3");
  });
});

describe("dialogToneClass", () => {
  test("one class pair per kind of dialog", () => {
    expect(dialogToneClass("start")).toBe("dialog-tone dialog-tone--start");
    expect(dialogToneClass("bill")).toBe("dialog-tone dialog-tone--bill");
    expect(dialogToneClass("unpaid")).toBe("dialog-tone dialog-tone--unpaid");
    expect(dialogToneClass("goods")).toBe("dialog-tone dialog-tone--goods");
  });
});

describe("seatLineWithKind", () => {
  test("a seat with no name says what it is; a named one is unchanged", () => {
    expect(seatLineWithKind("№2", ["PS5", "Standard"])).toBe("№2 · PS5 · Standard");
    expect(seatLineWithKind("№2", ["", null, "VIP"])).toBe("№2 · VIP");
    expect(seatLineWithKind("№2", [])).toBe("№2");
    expect(seatLineWithKind("№4 · Hall VIP", ["PS5", "VIP"])).toBe("№4 · Hall VIP");
  });
});
