import { fmt } from "@/i18n/translations";
import { billingAccessOf } from "@/types/platformBilling";
import { formatBillingDate } from "./billingFormat";

export type SayTone = "ok" | "warn" | "danger";

/**
 * The one sentence that tells an owner where their platform bill stands
 * (2026-11-09): paid / pay by <date> / today is the last day / overdue by N
 * days, and what that closes. Server figures only; nothing is worked out here.
 */
export const billingSay = (
  t: (k: string) => string,
  b: { paid: boolean; billingState: string | null; daysOverdue: number; access: unknown; dueOn: string | null },
): { text: string; tone: SayTone } => {
  if (b.paid) return { text: t("platformBilling.say.paid"), tone: "ok" };
  const access = billingAccessOf(b.access);
  if (b.daysOverdue > 0) {
    const what = access === "suspended" ? ` · ${t("platformBilling.say.suspended")}` : access === "restricted" ? ` · ${t("platformBilling.say.restricted")}` : "";
    return { text: fmt(t("platformBilling.say.overdue"), b.daysOverdue) + what, tone: "danger" };
  }
  if (b.billingState === "due") return { text: t("platformBilling.say.dueToday"), tone: "warn" };
  return { text: fmt(t("platformBilling.say.payBy"), formatBillingDate(b.dueOn)), tone: "warn" };
};

/** "July 2026" in the reader's language, from an invoice's first day. */
export const monthName = (periodStart: string | null | undefined, lang: string): string => {
  if (!periodStart) return "-";
  const d = new Date(`${periodStart}T12:00:00`);
  if (Number.isNaN(d.getTime())) return periodStart;
  return new Intl.DateTimeFormat(lang === "am" ? "hy" : lang, { month: "long", year: "numeric" }).format(d);
};
