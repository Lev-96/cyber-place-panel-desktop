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

export interface NoticeFact { label: string; value: string }

/**
 * What one notice says, in `lang` (Armenian for owners, the panel's own for an
 * admin): a short title, ONE plain sentence — what happened and what comes
 * next — and the two or three figures that matter, each on its own.
 */
export const billingNoticeContent = (
  n: Pick<IDbNotification, "type" | "data">,
  lang: Lang = NOTICE_LANG,
): { title: string; sentence: string; facts: NoticeFact[] } => {
  const kind = noticeKindOf(n);
  const title = t(kind ? `platformBilling.notice.${kind}` : "platformBilling.notice.generic", lang);

  const d = n.data ?? {};
  const balance = num(d.balance) ?? num(d.amount);
  const currency = str(d.currency) ?? "AMD";
  const money = (v: number | null) => v === null
    ? "-"
    : currency === "AMD" ? moneyDisplay.format(v, "AMD", lang, centsWhenFractional(v)) : `${v} ${currency}`;
  const due = formatBillingDate(str(d.effective_due_on) ?? str(d.due_on));
  const restrictionOn = formatBillingDate(str(d.restriction_on));
  const period = periodText(str(d.period_start), str(d.period_end));

  const sentence = kind
    ? fmt(t(`platformBilling.noticeSay.${kind}`, lang), kind === "overdue_d2" ? restrictionOn : due)
    : "";
  const settled = kind === "restored" || kind === "payment_recorded";
  const facts: NoticeFact[] = [
    { label: t(settled ? "platformBilling.noticeFact.left" : "platformBilling.noticeFact.owed", lang), value: money(balance) },
    ...(settled || kind === "extended" ? [] : [{ label: t("platformBilling.noticeFact.due", lang), value: due }]),
    { label: t("platformBilling.noticeFact.period", lang), value: period },
  ];
  return { title, sentence, facts };
};

/** Where "Details" leads: the invoice and its company, when the row names them. */
export const noticeTarget = (n: Pick<IDbNotification, "data">): { invoiceId: number | null; companyId: number | null } => ({
  invoiceId: typeof n.data?.invoice_id === "number" ? n.data.invoice_id : null,
  companyId: typeof n.data?.company_id === "number" ? n.data.company_id : null,
});
