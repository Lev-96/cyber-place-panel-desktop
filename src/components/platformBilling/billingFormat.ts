import { centsWhenFractional, formatAmount, type Currency } from "@/i18n/currency";
import { formatDate } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import {
  billingAccessOf,
  billingStateOf,
  type BillingAccess,
  type BillingState,
  type MoneyString,
} from "@/types/platformBilling";
import { useCallback } from "react";

/**
 * Display helpers for platform billing. FORMATTING ONLY: the server's decimal
 * strings are turned into a number for the formatter and printed; nothing is
 * added up, rounded to a different value or derived here.
 */

/** A server decimal string as a number for the formatter; unreadable → null. */
export const amountOf = (s: MoneyString | null | undefined): number | null => {
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const KNOWN_CURRENCIES: readonly string[] = ["AMD", "USD", "RUB"];

/**
 * Format a server amount in the invoice's own currency. AMD (the platform's
 * currency) goes through the panel's `money()` like every other amount, to
 * the hundredth only when the server's figure has one (a statement must add
 * up to the cent); another currency is printed literally.
 */
export const useBillingMoney = () => {
  const { money, lang } = useLang();
  return useCallback(
    (value: MoneyString | null | undefined, currency = "AMD"): string => {
      const n = amountOf(value);
      if (n === null) return "-";
      const cur = (currency || "AMD").toUpperCase();
      if (cur === "AMD") return money(n, centsWhenFractional(n));
      if (KNOWN_CURRENCIES.includes(cur)) return formatAmount(n, cur as Currency, lang);
      return `${value} ${cur}`;
    },
    [money, lang],
  );
};

/** "10%" / "12.5%" from the server's "10.00" / "12.50". */
export const percentText = (pct: MoneyString | null | undefined): string => {
  const n = amountOf(pct);
  return n === null ? "-" : `${n}%`;
};

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A calendar date ("2026-12-10") as "10.12.2026" WITHOUT a time-zone lift: a
 * due date is a day in Yerevan, and `new Date("2026-12-10")` is UTC midnight,
 * which a machine west of UTC would print as the 9th. Timestamps go through
 * the project's `formatDate`.
 */
export const formatBillingDate = (s: string | null | undefined): string => {
  if (!s) return "-";
  const m = YMD.exec(s);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : formatDate(s);
};

/** "01.10.2026 – 31.10.2026" (an en dash: a range, as on the prices page). */
export const periodText = (start: string | null | undefined, end: string | null | undefined): string =>
  `${formatBillingDate(start)} – ${formatBillingDate(end)}`;

/** Translation key of an invoice state; unknown → the generic "open". */
export const billingStateKey = (raw: unknown): string => {
  const s: BillingState | null = billingStateOf(raw);
  return s ? `platformBilling.state.${s}` : "platformBilling.state.unknown";
};

/** Badge tone of an invoice state (a `.billing-badge` modifier). */
export const billingStateTone = (raw: unknown): "ok" | "warn" | "danger" | "muted" => {
  switch (billingStateOf(raw)) {
    case "paid": return "ok";
    case "pending": return "muted";
    case "due":
    case "partially_paid": return "warn";
    case "overdue": return "danger";
    default: return "muted";
  }
};

export const billingAccessKey = (raw: unknown): string => `platformBilling.access.${billingAccessOf(raw)}`;

export const billingAccessTone = (raw: unknown): "ok" | "warn" | "danger" => {
  const a: BillingAccess = billingAccessOf(raw);
  return a === "suspended" ? "danger" : a === "restricted" ? "warn" : "ok";
};
