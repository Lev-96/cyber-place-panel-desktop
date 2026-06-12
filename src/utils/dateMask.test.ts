import { describe, expect, it } from "vitest";
import { dmyToIso, isoToDmy, maskDmy } from "./dateMask";

describe("isoToDmy", () => {
  it("formats an ISO date as dd.mm.yy", () => {
    expect(isoToDmy("2026-06-02")).toBe("02.06.26");
    expect(isoToDmy("2024-12-31")).toBe("31.12.24");
  });
  it("returns empty string for non-ISO input", () => {
    expect(isoToDmy("")).toBe("");
    expect(isoToDmy("2026/06/02")).toBe("");
    expect(isoToDmy("02.06.26")).toBe("");
  });
});

describe("dmyToIso", () => {
  it("parses dd.mm.yy to ISO with a 20YY year", () => {
    expect(dmyToIso("02.06.26")).toBe("2026-06-02");
    expect(dmyToIso("31.12.24")).toBe("2024-12-31");
  });
  it("rejects out-of-range day or month", () => {
    expect(dmyToIso("31.02.26")).toBeNull();
    expect(dmyToIso("00.06.26")).toBeNull();
    expect(dmyToIso("02.00.26")).toBeNull();
    expect(dmyToIso("02.13.26")).toBeNull();
  });
  it("respects leap years for Feb 29", () => {
    expect(dmyToIso("29.02.24")).toBe("2024-02-29");
    expect(dmyToIso("29.02.26")).toBeNull();
  });
  it("rejects incomplete or unmasked input", () => {
    expect(dmyToIso("2.6.26")).toBeNull();
    expect(dmyToIso("0206")).toBeNull();
    expect(dmyToIso("")).toBeNull();
  });
});

describe("maskDmy", () => {
  it("inserts dots as digits are typed", () => {
    expect(maskDmy("0")).toBe("0");
    expect(maskDmy("02")).toBe("02");
    expect(maskDmy("0206")).toBe("02.06");
    expect(maskDmy("020626")).toBe("02.06.26");
  });
  it("strips non-digits and caps at six digits", () => {
    expect(maskDmy("02.06.26")).toBe("02.06.26");
    expect(maskDmy("02062699")).toBe("02.06.26");
    expect(maskDmy("ab0206")).toBe("02.06");
  });
});
