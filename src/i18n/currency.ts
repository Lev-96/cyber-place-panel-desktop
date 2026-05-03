import { Lang } from "./translations";

/**
 * Money model: prices are stored in the company's BASE CURRENCY.
 * Default base = AMD (the Cyber Place network currency).
 * For display we convert to language-preferred currency using rates that the user
 * can override in Settings. Rates are FROM base TO target.
 *
 *   stored: 1000 AMD
 *   en (USD): 1000 / 400 ≈ 2.50 USD
 *   ru (RUB): 1000 / 4.2 ≈ 238.10 RUB
 *   am (AMD): 1000 dram (rendered with the localized word, never the
 *             "AMD" ISO code — Intl.NumberFormat would otherwise spell
 *             it out depending on which CLDR data Chromium ships)
 */

export type Currency = "AMD" | "USD" | "RUB";

export const LANG_TO_CURRENCY: Record<Lang, Currency> = {
  en: "USD",
  ru: "RUB",
  am: "AMD",
};

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
  en: "dram",
  ru: "драм",
  am: "դրամ",
};

/** Default rates: 1 AMD costs X target-currency. Adjustable via Settings. */
export const DEFAULT_RATES: Record<Currency, number> = {
  AMD: 1,
  USD: 1 / 400, // 1 AMD = 0.0025 USD ⇒ 1 USD ≈ 400 AMD
  RUB: 1 / 4.2, // 1 AMD ≈ 0.238 RUB ⇒ 1 RUB ≈ 4.2 AMD
};

export interface MoneyDisplay {
  /** Convert amount from BASE (AMD) to target currency. */
  convert(amountInBase: number, target: Currency): number;
  /**
   * Format amount-in-base as a localized string in target currency.
   * `lang` chooses the AMD unit word ("dram" / "драм" / "դրамm") when
   * target=AMD; ignored otherwise. Optional for back-compat with
   * call sites that don't have the lang in scope.
   */
  format(amountInBase: number, target: Currency, lang?: Lang): string;
}

export class StaticRateMoneyDisplay implements MoneyDisplay {
  constructor(private rates: Record<Currency, number> = DEFAULT_RATES) {}
  convert(amountInBase: number, target: Currency): number {
    const r = this.rates[target] ?? 1;
    return amountInBase * r;
  }
  format(amountInBase: number, target: Currency, lang: Lang = "am"): string {
    const value = this.convert(amountInBase, target);
    if (target === "AMD") {
      // Hand-format AMD to skip the ISO-code spell-out and pick the
      // localized unit word. Thousands separator follows the locale
      // via toLocaleString so a Russian UI reads "1 500 драм" while
      // an English one reads "1,500 dram".
      const number = value.toLocaleString(CURRENCY_LOCALE[target], {
        maximumFractionDigits: 0,
      });
      return `${number} ${AMD_UNIT[lang]}`;
    }
    return new Intl.NumberFormat(CURRENCY_LOCALE[target], {
      style: "currency",
      currency: target,
      maximumFractionDigits: 2,
    }).format(value);
  }
}

export const moneyDisplay = new StaticRateMoneyDisplay();
