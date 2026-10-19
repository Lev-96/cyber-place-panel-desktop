import { centsWhenFractional, type MoneyFormatOptions } from "@/i18n/currency";
import type { DifferenceKind } from "@/types/shifts";

/**
 * Cash typed at the till, as exact cents (2026-10-19). Only for showing the
 * difference while the amount is being typed; the figure that is recorded is
 * the server's, computed from the same two amounts.
 *
 * Accepts "47000", "47 000", "47000.5", "47000,50"; refuses anything else
 * (letters, a minus, three decimals) with null rather than guessing.
 */
export const parseCents = (input: string): number | null => {
  const s = input.replace(/[\s ]/g, "").replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
};

/** "1234.50" → 123450. The server's decimal strings always parse. */
export const centsOf = (amount: string): number => parseCents(amount) ?? 0;

/** 123450 → "1234.50", the form the API takes. */
export const toAmount = (cents: number): string => {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
};

export const kindOf = (differenceCents: number): DifferenceKind =>
  differenceCents < 0 ? "shortage" : differenceCents > 0 ? "surplus" : "none";

/**
 * A shift amount for the screen: whole drams when it is whole, the cents when
 * it has them. A till report that rounded 0.39 away would show a shortage of
 * "0" — the cents are shown precisely because they are money. Formatting only.
 */
export const shiftAmount = (
  money: (n: number, options?: MoneyFormatOptions) => string,
  amount: string | number,
): string => {
  const n = typeof amount === "number" ? amount : Number(amount);
  return money(n, centsWhenFractional(n));
};
