import { describe, expect, test } from "vitest";
import { t } from "@/i18n/translations";
import { formatRemaining } from "./duration";

describe("formatRemaining", () => {
  const ru = (k: string) => t(k, "ru");

  test("drops larger units as they reach zero, keeps two digits after a larger unit", () => {
    expect(formatRemaining(1 * 3600 + 12 * 60 + 8, ru)).toBe("1 ч 12 мин 08 сек");
    expect(formatRemaining(12 * 60 + 7, ru)).toBe("12 мин 07 сек");
    expect(formatRemaining(49 * 60 + 32, ru)).toBe("49 мин 32 сек");
    expect(formatRemaining(59, ru)).toBe("59 сек");
    expect(formatRemaining(0, ru)).toBe("0 сек");
    expect(formatRemaining(3600, ru)).toBe("1 ч 00 мин 00 сек");
  });

  test("never negative, never fractional", () => {
    expect(formatRemaining(-5, ru)).toBe("0 сек");
    expect(formatRemaining(59.9, ru)).toBe("59 сек");
  });

  test("in English and Armenian", () => {
    expect(formatRemaining(3000, (k) => t(k, "en"))).toBe("50 min 00 s");
    expect(formatRemaining(3000, (k) => t(k, "am"))).toBe("50 ր 00 վրկ");
  });
});
