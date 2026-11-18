import type { IPartner, PartnerTerms } from "@/api/partners";
import { fmt } from "@/i18n/translations";

type T = (key: string) => string;
type Money = (n: number) => string;

/**
 * A percent as people say it (2026-11-18): the server's "10.00" → "10",
 * "12.50" → "12.5". Trailing zeros are dropped from the STRING; nothing is
 * rounded or recomputed.
 */
export const percentText = (percent: string | null): string => {
  if (percent === null) return "0";
  return percent.includes(".") ? percent.replace(/0+$/, "").replace(/\.$/, "") : percent;
};

/** «10% остаётся клубу» / «50 000 ֏ в месяц платит клубу». */
export const termsLine = (
  p: { terms: PartnerTerms; percent: string | null; fixed_amount: string | null },
  t: T,
  money: Money,
): string =>
  p.terms === "percent"
    ? fmt(t("partners.termsPercent"), percentText(p.percent))
    : fmt(t("partners.termsFixed"), money(Number(p.fixed_amount ?? "0")));

/**
 * What the partner owes, as the server sent it: `partner_share` is negative
 * then ("-20000.00"), and the sentence says it without the sign. A string
 * edit, not arithmetic.
 */
export const owedAmount = (partnerShare: string): string => partnerShare.replace(/^-/, "");

/** `{year, month}` → the `YYYY-MM` the settlement asks for. */
export const monthParam = (sel: { year: number; month: number }): string =>
  `${sel.year}-${String(sel.month).padStart(2, "0")}`;

/**
 * The partners a product's «Чей товар» offers: active and not archived, plus
 * the product's own partner if it was archived or paused meanwhile (kept, so
 * the select shows the truth; it is never sent unless changed).
 */
export const partnerChoices = (list: readonly IPartner[], keepId: number | null): IPartner[] =>
  list.filter((p) => (!p.archived && p.active) || p.id === keepId);
