import { describe, expect, test } from "vitest";
import { StaticRateMoneyDisplay } from "./currency";

/**
 * Money is written in whole units everywhere it is a PRICE — a tariff, a
 * receipt, a day's revenue. That is the default and it stays the default: the
 * precision below is opt-in, and these tests exist so a caller that never asks
 * for it can never be given it.
 *
 * The exception it was added for is the running total on a session tile. A
 * venue charging twelve an hour earns two hundredths of a unit in the first
 * minute, so whole units read "0" for five minutes while the clock moves — and
 * that looks exactly like money not being counted.
 */
describe("money formatting", () => {
  const display = new StaticRateMoneyDisplay();

  test("a price is whole units, exactly as before", () => {
    expect(display.format(1500, "AMD", "ru")).toMatch(/^1.?500 драм$/);
    expect(display.format(0.35, "AMD", "ru")).toBe("0 драм");
    expect(display.format(12, "AMD", "ru")).toBe("12 драм");
  });

  test("a running total can ask for the fraction", () => {
    expect(display.format(0.35, "AMD", "ru", { maximumFractionDigits: 2 })).toBe("0,35 драм");
    expect(display.format(0.02, "AMD", "ru", { maximumFractionDigits: 2 })).toBe("0,02 драм");
  });

  test("asking for nothing changes nothing", () => {
    // The guard against the quiet kind of regression: a caller that passes no
    // options must be byte-identical to one from before the option existed.
    for (const amount of [0, 0.5, 7, 12.5, 1500, 999_999]) {
      expect(display.format(amount, "AMD", "ru", undefined)).toBe(display.format(amount, "AMD", "ru"));
    }
  });

  test("other currencies keep their own default too", () => {
    const usd = display.format(1000, "USD", "en");
    expect(usd).toBe(display.format(1000, "USD", "en", undefined));
    expect(display.format(1000, "USD", "en", { maximumFractionDigits: 0 })).not.toContain(".");
  });
});
