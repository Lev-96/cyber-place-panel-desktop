import type { ISalesLine, ISalesMethodRow, ISalesSummary } from "@/api/salesSummary";
import { formatDate } from "@/i18n/dates";
import { fmt } from "@/i18n/translations";

type T = (key: string) => string;

/** `2026-11-18` → `18.11.2026`. */
const dmy = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : formatDate(iso);
};

/**
 * Which days the figures are for, in words (2026-11-18, owner: «чтобы
 * пользователь понимал за какой день он смотрит данные»):
 * «Сегодня, 18.11.2026», «18.11.2026», «с 01.11.2026 по 18.11.2026».
 */
export const periodLine = (w: ISalesSummary["window"], t: T): string => {
  if (w.date_from === w.date_to) {
    return w.is_today ? fmt(t("sales.todayDate"), dmy(w.date_from)) : dmy(w.date_from);
  }
  return fmt(t("sales.range"), dmy(w.date_from), dmy(w.date_to));
};

/** `2026-11-18` + n days, as a date string (no clock, no zone). */
const plusDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/**
 * «Расчёт: с 13:00 18.11.2026 до 07:00 19.11.2026» (2026-11-18, owner: the
 * days themselves, not only the hours) — the last day closes the NEXT morning
 * when its hours run past midnight. Without published hours: the calendar day.
 */
export const hoursLine = (w: ISalesSummary["window"], t: T): string => {
  if (!w.business_day) return t("sales.calendarDay");
  const { start, end } = w.business_day;
  const endDay = end <= start ? plusDays(w.date_to, 1) : w.date_to;
  return fmt(t("sales.hours"), start, dmy(w.date_from), end, dmy(endDay));
};

/** A method row's name: its own for a «Свой вариант», else the method's. */
export const methodName = (row: Pick<ISalesMethodRow, "method" | "label">, t: T): string => {
  if (row.label) return row.label;
  switch (row.method) {
    case "cash": return t("sales.method.cash");
    case "card": return t("sales.method.card");
    case "other": return t("sales.method.other");
    case "deposit": return t("sales.method.deposit");
    default: return t("sales.method.unrecorded");
  }
};

/**
 * «Наличные 1 000 · Idram 500» — how one record was paid. Since 2026-11-20 a
 * place paid ahead shows what changed hands at its close: «Доплата» parts, or
 * «Сдача / возврат» (a negative part), or «Оплачено заранее, без доплаты».
 */
export const partsLine = (l: ISalesLine, money: (n: number) => string, t: T): string => {
  const paidAhead = l.kind === "place" && Number(l.prepaid ?? 0) > 0;
  if (l.payments.length === 0) return paidAhead ? t("sales.aheadSettled") : t("sales.method.unrecorded");
  return l.payments.map((p) => {
    const amount = Number(p.amount);
    const name = methodName({ method: p.method, label: p.label ?? null }, t);
    return amount < 0 ? fmt(t("sales.refund"), name, money(-amount)) : `${name} ${money(amount)}`;
  }).join(" · ");
};

/** What a record is worth on screen: a place's whole bill, else what was taken. */
export const lineAmount = (l: ISalesLine): number => Number(l.kind === "place" && l.bill != null ? l.bill : l.amount);

/** Where a record happened: the seat, or «Товары без места»; a sum paid ahead says so. */
export const whereLine = (l: ISalesLine, t: T): string => {
  if (l.kind === "till") return t("sales.tillWhere");
  const seat = l.seat ?? (l.place?.number != null ? `№${l.place.number}` : "-");
  return l.kind === "prepaid" ? fmt(t("sales.aheadWhere"), seat) : seat;
};
