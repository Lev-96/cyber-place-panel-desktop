/**
 * Shared presentation helpers for the recurring-services expense tracker.
 * One source of truth for the "due in N days" wording and the urgency
 * colour, used by the Expenses page (banner + list) and the Notifications
 * reminder card alike — so they never drift apart.
 */

export const REMIND_WITHIN_DAYS = 3;

type Translate = (key: string) => string;

/** Urgency tone: red overdue/≤1 day, amber within the reminder window, else green. */
export const dueTone = (days: number): string =>
  days <= 1 ? "#ef4444" : days <= REMIND_WITHIN_DAYS ? "#f59e0b" : "#22c55e";

const dayUnit = (n: number, t: Translate): string =>
  n === 1 ? t("expenses.dayShort") : t("expenses.daysShort");

/** Localized "overdue by N days" / "due today" / "in N days". */
export const dueLabel = (days: number, t: Translate): string => {
  if (days < 0) return `${t("expenses.overdue")} ${Math.abs(days)} ${dayUnit(Math.abs(days), t)}`;
  if (days === 0) return t("expenses.dueToday");
  return `${t("expenses.dueIn")} ${days} ${dayUnit(days, t)}`;
};
