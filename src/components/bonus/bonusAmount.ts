import { centsWhenFractional, type MoneyFormatOptions } from "@/i18n/currency";

/**
 * A card's bonuses exactly as the server holds them (2026-11-25, owner: 1:1):
 * «43.89», never a rounded «44»; a whole sum without «.00».
 */
export const bonusAmountText = (money: (amount: number, options?: MoneyFormatOptions) => string, raw: string | number): string => {
  const n = Number(raw);
  const v = Number.isFinite(n) ? n : 0;
  return money(v, centsWhenFractional(v));
};
