import { describe, expect, it } from "vitest";
import { isHomeCountryRecord, nationalPart } from "./countries";
import { toNationalDigits } from "@/components/ui/FixedDialPhoneInput";
import { normalizeWebsite } from "@/components/companies/CompanyForm";

/** Armenia / +374 fixed forms and the company website rule (2026-10-11). */
describe("home country records", () => {
  it("blank, Armenia or a +374 / national number are home records", () => {
    expect(isHomeCountryRecord("", "")).toBe(true);
    expect(isHomeCountryRecord("Armenia", "+374 77 123456")).toBe(true);
    expect(isHomeCountryRecord("AM", "077123456")).toBe(true);
    expect(isHomeCountryRecord(null, undefined)).toBe(true);
  });

  it("another country or another international code is legacy data, kept as is", () => {
    expect(isHomeCountryRecord("Georgia", "+374 77 123456")).toBe(false);
    expect(isHomeCountryRecord("Armenia", "+995 555 123456")).toBe(false);
  });

  it("the national part drops the code once", () => {
    expect(nationalPart("+374 77 123456", "AM")).toBe("77123456");
    expect(nationalPart("077123456", "AM")).toBe("077123456");
  });
});

describe("toNationalDigits", () => {
  it("strips one +374 or 00374, then everything that is not a digit", () => {
    expect(toNationalDigits("+374 77 12 34 56", "374")).toBe("77123456");
    expect(toNationalDigits("00374-77-123456", "374")).toBe("77123456");
    expect(toNationalDigits("+374+374 77", "374")).toBe("37477");
    expect(toNationalDigits("077 123456", "374")).toBe("077123456");
    expect(toNationalDigits("", "374")).toBe("");
  });
});

describe("normalizeWebsite", () => {
  it("adds https:// to a bare host and keeps an http(s) URL", () => {
    expect(normalizeWebsite(" club.am ")).toBe("https://club.am");
    expect(normalizeWebsite("http://club.am/path")).toBe("http://club.am/path");
    expect(normalizeWebsite("https://www.club.am")).toBe("https://www.club.am");
  });

  it("refuses blank, spaces, a host with no dot and other schemes", () => {
    for (const bad of ["", "   ", "club", "not a site", "ftp://club.am", "https://club.", "mailto:a@b.am"]) {
      expect(normalizeWebsite(bad), bad).toBeNull();
    }
  });
});
