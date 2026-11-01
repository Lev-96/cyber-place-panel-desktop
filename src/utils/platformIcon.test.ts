import { describe, expect, test } from "vitest";
import { platformIconKind } from "./platform";

/**
 * Which icon a platform gets. Known platforms by group; a venue's own by the
 * words in its slug (derived from the English name), so one added later under
 * such a name is drawn right; anything else is the neutral mark.
 */
describe("platformIconKind", () => {
  test.each([
    ["pc", "pc"],
    ["ps4", "ps"],
    ["ps5", "ps"],
    ["ps6", "ps"],
    ["poker", "poker"],
    ["texas-holdem", "poker"],
    ["table-tennis", "table-tennis"],
    ["ping-pong", "table-tennis"],
    ["billiards", "billiards"],
    ["pool-table", "billiards"],
    ["snooker", "billiards"],
    ["vr", "vr"],
    ["vr-room", "vr"],
    ["virtual-reality", "vr"],
    ["karaoke", "other"],
    ["", "other"],
  ])("%s → %s", (slug, kind) => {
    expect(platformIconKind(slug)).toBe(kind);
  });

  test("is not fooled by letters inside other words", () => {
    // "esports" contains "ps", yet it is not a console.
    expect(platformIconKind("esports-arena")).toBe("other");
    expect(platformIconKind("driver-sim")).toBe("other");
    // "vr" only as a word: inside another word it is not a headset.
    expect(platformIconKind("chevron-room")).toBe("other");
    expect(platformIconKind(null)).toBe("other");
  });
});
