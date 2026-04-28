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
 *   am (AMD): 1000 AMD
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

/** Default rates: 1 AMD costs X target-currency. Adjustable via Settings. */
export const DEFAULT_RATES: Record<Currency, number> = {
  AMD: 1,
  USD: 1 / 400, // 1 AMD = 0.0025 USD ⇒ 1 USD ≈ 400 AMD
  RUB: 1 / 4.2, // 1 AMD ≈ 0.238 RUB ⇒ 1 RUB ≈ 4.2 AMD
};

export interface MoneyDisplay {
  /** Convert amount from BASE (AMD) to target currency. */
  convert(amountInBase: number, target: Currency): number;
  /** Format amount-in-base as a localized string in target currency. */
  format(amountInBase: number, target: Currency): string;
}

export class StaticRateMoneyDisplay implements MoneyDisplay {
  constructor(private rates: Record<Currency, number> = DEFAULT_RATES) {}
  convert(amountInBase: number, target: Currency): number {
    const r = this.rates[target] ?? 1;
    return amountInBase * r;
  }
  format(amountInBase: number, target: Currency): string {
    const value = this.convert(amountInBase, target);
    return new Intl.NumberFormat(CURRENCY_LOCALE[target], {
      style: "currency",
      currency: target,
      maximumFractionDigits: target === "AMD" ? 0 : 2,
    }).format(value);
  }
}

export const moneyDisplay = new StaticRateMoneyDisplay();
