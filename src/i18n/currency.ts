import { Lang } from "./translations";

/**
 * Money model: prices are stored in the company's BASE CURRENCY.
 * Default base = AMD (the Cyber Place network currency).
 * For display we convert to the currency selected in Settings (default
 * AMD) using static rates. Rates are FROM base TO target.
 *
 *   stored: 1000 AMD
 *   AMD: 1000 dram (rendered with the localized word, never the
 *        "AMD" ISO code — Intl.NumberFormat would otherwise spell
 *        it out depending on which CLDR data Chromium ships)
 *   USD: 1000 / 400 ≈ 2.50 USD
 *   RUB: 1000 / 5.14 ≈ 194.44 RUB
 */

export type Currency = "AMD" | "USD" | "RUB";

export const CURRENCY_LOCALE: Record<Currency, string> = {
  AMD: "hy-AM",
  USD: "en-US",
  RUB: "ru-RU",
};

/**
 * Localized name of the AMD unit per UI language. We render it
 * manually because Intl.NumberFormat on AMD yields "AMD 1,000" in
 * environments whose CLDR doesn't carry a localized currency name —
 * which is the case in this Electron Chromium build.
 */
export const AMD_UNIT: Record<Lang, string> = {
  en: "AMD",
  ru: "драм",
  am: "դրամ",
};

/** Default rates: 1 AMD costs X target-currency. Adjustable via Settings.
 *
 *  RUB last updated 2026-05-23 against the published mid-market rate
 *  (1000 RUB = 5142.93 AMD). The previous 1/4.2 figure was a stale
 *  placeholder from an earlier 2025-era rate that made a 1000-руб
 *  tariff render as ~4200 AMD instead of the correct ~5143 AMD. */
export const DEFAULT_RATES: Record<Currency, number> = {
  AMD: 1,
  USD: 1 / 400,       // 1 AMD = 0.0025 USD ⇒ 1 USD ≈ 400 AMD
  RUB: 1 / 5.14293,   // 1 AMD ≈ 0.1944 RUB ⇒ 1 RUB ≈ 5.143 AMD
};

export interface MoneyDisplay {
  /** Convert amount from BASE (AMD) to target currency. */
  convert(amountInBase: number, target: Currency): number;
  /**
   * Convert an amount that is ALREADY in `from` currency into `to`
   * currency, routing through the AMD base. Used by the expense tracker
   * to roll mixed-currency monthly costs into one grand total. Reads the
   * same live rates as `convert`, so it tracks the daily FX refresh.
   */
  convertBetween(amount: number, from: Currency, to: Currency): number;
  /**
   * Format amount-in-base as a localized string in target currency.
   * `lang` chooses the AMD unit word ("dram" / "драм" / "դրамm") when
   * target=AMD; ignored otherwise. Optional for back-compat with
   * call sites that don't have the lang in scope.
   */
  format(amountInBase: number, target: Currency, lang?: Lang, options?: MoneyFormatOptions): string;
}

/**
 * How much of a fraction to show.
 *
 * Money is written in whole units everywhere it is a PRICE — a tariff, a
 * receipt, a day's revenue — and that is the default here and stays the
 * default. A running total is the one place where it is wrong: a session at
 * twelve per hour earns two hundredths of a unit in its first minute, and a
 * counter that reads "0" while the clock moves looks broken.
 */
export interface MoneyFormatOptions {
  maximumFractionDigits?: number;
}

export class StaticRateMoneyDisplay implements MoneyDisplay {
  constructor(private rates: Record<Currency, number> = DEFAULT_RATES) {}
  convert(amountInBase: number, target: Currency): number {
    const r = this.rates[target] ?? 1;
    return amountInBase * r;
  }
  convertBetween(amount: number, from: Currency, to: Currency): number {
    // rates are "1 AMD costs X target", so AMD = amount / rates[from].
    const rFrom = this.rates[from] ?? 1;
    const rTo = this.rates[to] ?? 1;
    return (amount / rFrom) * rTo;
  }
  format(amountInBase: number, target: Currency, lang: Lang = "am", options?: MoneyFormatOptions): string {
    const value = this.convert(amountInBase, target);
    if (target === "AMD") {
      // Hand-format AMD to skip the ISO-code spell-out and pick the
      // localized unit word. Thousands separator follows the locale
      // via toLocaleString so a Russian UI reads "1 500 драм" while
      // an English one reads "1,500 dram".
      const number = value.toLocaleString(CURRENCY_LOCALE[target], {
        maximumFractionDigits: options?.maximumFractionDigits ?? 0,
      });
      return `${number} ${AMD_UNIT[lang]}`;
    }
    return new Intl.NumberFormat(CURRENCY_LOCALE[target], {
      style: "currency",
      currency: target,
      maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    }).format(value);
  }
}

export const moneyDisplay = new StaticRateMoneyDisplay();

/**
 * Formatting options for an amount that was CALCULATED rather than set.
 *
 * A price somebody typed is a whole number and reads best as one. A time cost
 * is arithmetic — a rate times a duration — and at twelve an hour a short
 * session comes to a third of a unit. Rounded to whole units that is "0", which
 * an operator reads as "the system did not charge anything", and it is the
 * difference between a total and no total at all.
 *
 * So: show the fraction only while the amount would otherwise disappear, and
 * whole units as soon as there is something to round.
 */
export const preciseWhenSmall = (amount: number): MoneyFormatOptions | undefined =>
  Math.abs(amount) > 0 && Math.abs(amount) < 100 ? { maximumFractionDigits: 2 } : undefined;

/**
 * Format an amount that is ALREADY denominated in `currency` — no base
 * conversion. `moneyDisplay.format` assumes an AMD-base input, so it is
 * the wrong tool when a value is literally "$12 USD" (the expense
 * tracker's per-service prices). Mirrors `format`'s AMD hand-formatting
 * so a literal AMD amount still reads "1,000 dram", never "AMD 1,000".
 */
export const formatAmount = (value: number, currency: Currency, lang: Lang = "am"): string => {
  if (currency === "AMD") {
    const number = value.toLocaleString(CURRENCY_LOCALE[currency], {
      maximumFractionDigits: 0,
    });
    return `${number} ${AMD_UNIT[lang]}`;
  }
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
};
