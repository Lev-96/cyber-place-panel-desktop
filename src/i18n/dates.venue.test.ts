import { describe, expect, test } from "vitest";
import { formatVenueDate, formatVenueTime, venueDateInput, venueMonthBoundsIso } from "./dates";

/**
 * The money screens count on the venue's clock, Asia/Yerevan (2026-11-18,
 * owner), whatever zone the machine is in. Every case is an INSTANT, so the
 * answers hold on any machine.
 */
describe("the venue's calendar (Asia/Yerevan)", () => {
  test("21:30 UTC is already the next day, 01:30, in Yerevan", () => {
    const at = new Date("2026-11-17T21:30:00Z");
    expect(venueDateInput(at)).toBe("2026-11-18");
    expect(formatVenueDate(at)).toBe("18.11.2026");
    expect(formatVenueTime(at)).toBe("01:30");
  });

  test("a month runs from its 1st 00:00 to its last 23:59:59.999 in Yerevan", () => {
    expect(venueMonthBoundsIso(2026, 11)).toEqual({ from: "2026-10-31T20:00:00.000Z", to: "2026-11-30T19:59:59.999Z" });
    expect(venueMonthBoundsIso(2026, 2)).toEqual({ from: "2026-01-31T20:00:00.000Z", to: "2026-02-28T19:59:59.999Z" });
    expect(venueMonthBoundsIso(2026, 12).to).toBe("2026-12-31T19:59:59.999Z");
  });
});
