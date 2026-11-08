import type { IDbNotification } from "@/api/notifications";
import { centsWhenFractional, moneyDisplay } from "@/i18n/currency";
import { fmt, t, type Lang } from "@/i18n/translations";
import { formatBillingDate, periodText, amountOf } from "./billingFormat";

/**
 * Cyber Place Platform payment notices in the feed (2026-11-09).
 *
 * The backend writes one database row per stage (`PlatformBillingNotice::
 * toArray()`): `data.type = "platform_billing.<kind>"` plus the invoice's
 * figures — data only, no prose. The wording is the panel's, and it is
 * ARMENIAN whatever language the panel is in (owner rule: payment notices are
 * Armenian in every channel — mail, Telegram, the panel). The titles are the
 * owner's own, the same as the backend's `lang/am/billing.php`.
 */

export const PLATFORM_BILLING_PREFIX = "platform_billing.";

/** The language payment notices are written in, always. */
export const NOTICE_LANG: Lang = "am";

/** Stages the backend sends (the optional ones and the mandatory ones). */
export const NOTICE_KINDS = [
  "reminder_d_minus_3", "due_today", "overdue_d2", "restricted_d5", "suspended_d7",
  "restored", "payment_recorded", "extended",
] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

const KNOWN: readonly string[] = NOTICE_KINDS;

const dataType = (n: Pick<IDbNotification, "type" | "data">): string =>
  typeof n.data?.type === "string" ? n.data.type : n.type;

/** Is this feed row a platform payment notice? */
export const isPlatformBillingNotice = (n: Pick<IDbNotification, "type" | "data">): boolean =>
  dataType(n).startsWith(PLATFORM_BILLING_PREFIX);

/** The stage of a notice ("overdue_d2"), or null for a stage this build does not know. */
export const noticeKindOf = (n: Pick<IDbNotification, "type" | "data">): NoticeKind | null => {
  const kind = dataType(n).slice(PLATFORM_BILLING_PREFIX.length);
  return KNOWN.includes(kind) ? (kind as NoticeKind) : null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
/** A figure the row carries as a decimal string (the contract) or a number. */
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : amountOf(str(v)));

/** Title and body of a notice, in Armenian. */
export const billingNoticeText = (n: Pick<IDbNotification, "type" | "data">): { title: string; body: string } => {
  const kind = noticeKindOf(n);
  const title = t(kind ? `platformBilling.notice.${kind}` : "platformBilling.notice.generic", NOTICE_LANG);

  const d = n.data ?? {};
  const balance = num(d.balance) ?? num(d.amount);
  const currency = str(d.currency) ?? "AMD";
  const amount = balance === null
    ? "-"
    : currency === "AMD"
      ? moneyDisplay.format(balance, "AMD", NOTICE_LANG, centsWhenFractional(balance))
      : `${balance} ${currency}`;
  const due = formatBillingDate(str(d.effective_due_on) ?? str(d.due_on));
  const period = periodText(str(d.period_start), str(d.period_end));

  const lines = [fmt(t("platformBilling.notice.body", NOTICE_LANG), period, amount, due)];
  if (kind === "restricted_d5") lines.push(t("platformBilling.notice.bodyRestricted", NOTICE_LANG));
  if (kind === "suspended_d7") lines.push(t("platformBilling.notice.bodySuspended", NOTICE_LANG));
  if (kind === "restored") lines.push(t("platformBilling.notice.bodyRestored", NOTICE_LANG));
  const company = str(d.company_name);
  return { title, body: [company, ...lines].filter(Boolean).join(" ") };
};

/** Where "Details" leads: the invoice and its company, when the row names them. */
export const noticeTarget = (n: Pick<IDbNotification, "data">): { invoiceId: number | null; companyId: number | null } => ({
  invoiceId: typeof n.data?.invoice_id === "number" ? n.data.invoice_id : null,
  companyId: typeof n.data?.company_id === "number" ? n.data.company_id : null,
});
