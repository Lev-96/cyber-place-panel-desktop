import { describe, expect, test } from "vitest";
import { freeUntilOf } from "./reservationText";

describe("a free seat's «Свободно до»", () => {
  const now = new Date(2026, 10, 7, 12, 0, 0);
  test("the next reservation's start, when it is ahead and within a day", () => {
    expect(freeUntilOf(new Date(2026, 10, 7, 16, 0).toISOString(), now)).toBe("16:00");
  });
  test("nothing ahead, already under way, or more than a day away: nothing shown", () => {
    expect(freeUntilOf(null, now)).toBeNull();
    expect(freeUntilOf(undefined, now)).toBeNull();
    expect(freeUntilOf(new Date(2026, 10, 7, 11, 0).toISOString(), now)).toBeNull();
    expect(freeUntilOf(new Date(2026, 10, 9, 16, 0).toISOString(), now)).toBeNull();
    expect(freeUntilOf("not a date", now)).toBeNull();
  });
});
