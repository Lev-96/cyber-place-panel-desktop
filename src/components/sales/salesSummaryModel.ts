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

/** «Расчёт с 13:00 до 07:00» — or the calendar day when the branch has no hours. */
export const hoursLine = (w: ISalesSummary["window"], t: T): string =>
  w.business_day ? fmt(t("sales.hours"), w.business_day.start, w.business_day.end) : t("sales.calendarDay");

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

/** «Наличные 1 000 · Idram 500» — how one record was paid. */
export const partsLine = (l: ISalesLine, money: (n: number) => string, t: T): string =>
  l.payments.length === 0
    ? t("sales.method.unrecorded")
    : l.payments.map((p) => `${methodName({ method: p.method, label: p.label ?? null }, t)} ${money(Number(p.amount))}`).join(" · ");

/** Where a record happened: the seat, or «Товары без места». */
export const whereLine = (l: ISalesLine, t: T): string =>
  l.kind === "till" ? t("sales.tillWhere") : (l.seat ?? (l.place?.number != null ? `№${l.place.number}` : "-"));
