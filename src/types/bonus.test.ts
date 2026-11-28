import { describe, expect, test } from "vitest";
import { bonusCodeFromScan, normaliseBonusCode } from "./bonus";

describe("the bonus code", () => {
  test("case and spaces are forgiven, as on the server", () => {
    expect(normaliseBonusCode("abc 234")).toBe("ABC234");
    expect(normaliseBonusCode(" XYZ789 ")).toBe("XYZ789");
  });
  test("letters that can be misread are not a code", () => {
    for (const bad of ["ABC10O", "ABCDEI", "ABCDEL", "ABC23", "ABC2345", "ABC-23"]) expect(normaliseBonusCode(bad)).toBeNull();
  });
  test("a scanned QR is the player's link or the bare code", () => {
    expect(bonusCodeFromScan("https://cyberplace.pro/card/#c=abc234")).toBe("ABC234");
    expect(bonusCodeFromScan("ABC234")).toBe("ABC234");
    expect(bonusCodeFromScan("https://example.com/?x=1")).toBeNull();
  });
});
