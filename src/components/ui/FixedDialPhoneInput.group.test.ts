import { describe, expect, test } from "vitest";
import { groupNational } from "./FixedDialPhoneInput";

describe("groupNational — Armenian digits as people read them (2026-11-25)", () => {
  test("8 digits: 2-3-3; a leading 0: 3-3-3; partial as typed so far", () => {
    expect(groupNational("91123456", "AM")).toBe("91 123 456");
    expect(groupNational("091123456", "AM")).toBe("091 123 456");
    expect(groupNational("9112", "AM")).toBe("91 12");
    expect(groupNational("", "AM")).toBe("");
  });
  test("another country: exactly as typed", () => {
    expect(groupNational("5551234567", "US")).toBe("5551234567");
  });
});
