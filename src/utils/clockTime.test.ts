import { describe, expect, test } from "vitest";
import { HHMM_RE, minutesOfDay, toHHMM } from "./clockTime";

describe("toHHMM", () => {
  test("trims a TIME column's seconds and keeps an HH:MM as it is", () => {
    expect(toHHMM("10:00:00")).toBe("10:00");
    expect(toHHMM("02:40:59")).toBe("02:40");
    expect(toHHMM("23:59")).toBe("23:59");
    expect(toHHMM("00:00")).toBe("00:00");
  });

  test("anything else is null, never a half-trimmed guess", () => {
    for (const bad of ["9:00", "24:00", "10:60", "10:00:60", "10:00:00.000", "1000", "", "abc", null, undefined]) {
      expect(toHHMM(bad), String(bad)).toBeNull();
    }
  });
});

describe("HHMM_RE / minutesOfDay", () => {
  test("accept only a complete 24-hour HH:MM", () => {
    expect(HHMM_RE.test("00:00")).toBe(true);
    expect(HHMM_RE.test("23:59")).toBe(true);
    expect(HHMM_RE.test("10:00:00")).toBe(false);
    expect(HHMM_RE.test("1:00")).toBe(false);
  });

  test("counts minutes from midnight", () => {
    expect(minutesOfDay("00:00")).toBe(0);
    expect(minutesOfDay("02:40")).toBe(160);
    expect(minutesOfDay("23:59")).toBe(1439);
  });
});
