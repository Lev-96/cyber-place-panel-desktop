import { describe, expect, test } from "vitest";
import { centsWhenFractional, preciseWhenSmall, StaticRateMoneyDisplay } from "./currency";

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

  test("a calculated amount shows its fraction only while it would vanish", () => {
    // Nothing to show a fraction of.
    expect(preciseWhenSmall(0)).toBeUndefined();
    // The case this exists for: a third of a unit is not "nothing charged".
    expect(preciseWhenSmall(0.35)).toEqual({ maximumFractionDigits: 2 });
    expect(preciseWhenSmall(12.5)).toEqual({ maximumFractionDigits: 2 });
    // Big enough that the hundredths are noise on a bill.
    expect(preciseWhenSmall(100)).toBeUndefined();
    expect(preciseWhenSmall(1500)).toBeUndefined();
  });

  test("a total under one unit reads as itself, not as zero", () => {
    const amount = 0.35;
    expect(display.format(amount, "AMD", "ru")).toBe("0 драм");
    expect(display.format(amount, "AMD", "ru", preciseWhenSmall(amount))).toBe("0,35 драм");
  });

  test("other currencies keep their own default too", () => {
    const usd = display.format(1000, "USD", "en");
    expect(usd).toBe(display.format(1000, "USD", "en", undefined));
    expect(display.format(1000, "USD", "en", { maximumFractionDigits: 0 })).not.toContain(".");
  });
});

/**
 * The revenue screen is a statement of account: its figures come from the
 * server to the hundredth (9000.50 / 900.05 / 8100.45), and rounded to whole
 * units they stop adding up on the card — 9,001 − 900 ≠ 8,100. There, and only
 * there, an amount with a fraction shows both of its digits.
 *
 * The rule: the SERVER value has non-zero cents → exactly two decimals; a whole
 * amount → no decimals at all. Decided per amount, never derived from others.
 */
describe("centsWhenFractional — the revenue screen's rule", () => {
  const display = new StaticRateMoneyDisplay();
  const shown = (amount: number) => display.format(amount, "AMD", "en", centsWhenFractional(amount));

  test("an amount with cents asks for exactly two decimals", () => {
    expect(centsWhenFractional(9000.5)).toEqual({ minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(centsWhenFractional(900.05)).toEqual({ minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(centsWhenFractional(-12.5)).toEqual({ minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });

  test("a whole amount asks for nothing, so it prints exactly as money() always did", () => {
    expect(centsWhenFractional(9000)).toBeUndefined();
    expect(centsWhenFractional(0)).toBeUndefined();
    // Float noise below a cent is not a fraction anybody was charged.
    expect(centsWhenFractional(9000.004)).toBeUndefined();
    expect(centsWhenFractional(1500.0000001)).toBeUndefined();
  });

  test("9000.50 prints its .50 — not 9,001, and not 9,000.5", () => {
    // Separators follow the ICU data (Node: "9000,50"; the Electron build:
    // "9,000.50"); the two decimal digits are what this pins.
    expect(shown(9000.5)).toMatch(/^9\D?000[.,]50 AMD$/);
    expect(shown(900.05)).toMatch(/^900[.,]05 AMD$/);
    expect(shown(8100.45)).toMatch(/^8\D?100[.,]45 AMD$/);
  });

  test("9000 prints without decimals", () => {
    expect(shown(9000)).toMatch(/^9\D?000 AMD$/);
    expect(shown(9000)).toBe(display.format(9000, "AMD", "en"));
    expect(shown(0)).toBe("0 AMD");
  });

  test("a minimum alone never collides with the whole-unit default", () => {
    // Intl throws a RangeError for minimumFractionDigits 2 with a maximum of 0,
    // which is what the AMD default maximum is. The formatter must widen it.
    expect(display.format(1, "AMD", "ru", { minimumFractionDigits: 2 })).toBe("1,00 драм");
  });
});
