import { describe, expect, test } from "vitest";
import { formatArmenianPhone, maskArmenianPhone, normalizeArmenianPhone } from "./armenianPhone";

describe("Armenian phone on a reservation", () => {
  test("every way people type or paste it becomes one number", () => {
    for (const typed of ["077777777", "077 777 777", "+374 77 777777", "+37477777777", "37477777777", "(077) 77-77-77", "77777777", " 077-777-777 ", "00374 77 777777"]) {
      expect(normalizeArmenianPhone(typed)).toBe("+37477777777");
    }
  });

  test("short, long or empty is not a number", () => {
    for (const bad of ["", "0777", "07777777", "abc", "+7 999 123 45 67", "000 777 777", "0777 777 7777"]) {
      expect(normalizeArmenianPhone(bad)).toBeNull();
    }
  });

  test("the field shows it as 0XX XXX XXX while typing, never more digits", () => {
    expect(maskArmenianPhone("")).toBe("");
    expect(maskArmenianPhone("0")).toBe("0");
    expect(maskArmenianPhone("077")).toBe("077");
    expect(maskArmenianPhone("07777")).toBe("077 77");
    expect(maskArmenianPhone("077777777")).toBe("077 777 777");
    expect(maskArmenianPhone("0777777771234")).toBe("077 777 777");
    expect(maskArmenianPhone("+374 91 123456")).toBe("091 123 456");
    expect(maskArmenianPhone("91")).toBe("091");
  });

  test("a stored number is shown the same way; an old free-form one as it was", () => {
    expect(formatArmenianPhone("+37491123456")).toBe("091 123 456");
    expect(formatArmenianPhone("+374 91 123456")).toBe("091 123 456");
    expect(formatArmenianPhone("call me")).toBe("call me");
    expect(formatArmenianPhone(null)).toBe("");
  });
});
