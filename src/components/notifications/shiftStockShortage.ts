import { venueSpan } from "@/components/shifts/acceptance/acceptanceCount";
import { fmt, t as translate } from "@/i18n/translations";

/**
 * The owner's bell row for a shortage found when a shift was accepted
 * (2026-11-18, backend `ShiftStockShortage`, `data.type =
 * "shift.stock_shortage"`): «Недостача при приёме смены: 500 драм» over
 * «Abovyan 1 · смена Anna 17.11 10:00–12:00», then the products. Every figure
 * is the server's (`total_value`, `items[].value`), only formatted.
 */
export const SHIFT_STOCK_SHORTAGE = "shift.stock_shortage";

/** How many products the row names before «и ещё N». */
const ITEMS_SHOWN = 3;

/**
 * The row's `data` as it arrives: read field by field (shift_id, total_value,
 * branch_address, blamed_user_name, window_from, window_to, gap, items,
 * items_total), each checked, since an older row may lack any of them.
 */
type ShortageData = Readonly<Record<string, unknown>>;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const shiftShortageTarget = (data: ShortageData): string | null => {
  const id = Number(data.shift_id);
  return Number.isInteger(id) && id > 0 ? `/shifts?shift_id=${id}` : null;
};

/**
 * «1 000 դրամ»: the server's amount, whole drams grouped, cents only when
 * there are any — in Armenian whatever the screen's language.
 */
const amd = (value: string): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${value} դրամ`;
  const whole = Math.trunc(Math.abs(n));
  const cents = Math.round((Math.abs(n) - whole) * 100);
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "-" : ""}${grouped}${cents > 0 ? `.${String(cents).padStart(2, "0")}` : ""} դրամ`;
};

/**
 * The row, ALWAYS in Armenian and in a few words (2026-11-18, owner: the
 * owner reads a shortage in Armenian, plainly, without quotes). The screen's
 * own `t` and money formatter are not used for it.
 */
export const shiftShortageText = (
  data: ShortageData,
  _t?: (key: string) => string,
  _amount?: (value: string) => string,
): { headline: string; body: string; items: string | null; gap: string | null } => {
  const t = (key: string) => translate(key, "am");
  const amount = amd;
  const fill = (template: string, vars: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (whole, k: string) => vars[k] ?? whole);

  const headline = fill(t("notifications.stockShortageTitle"), { amount: amount(str(data.total_value) || "0") });
  const body = fill(t("notifications.stockShortageBody"), {
    branch: str(data.branch_address) || "-",
    name: str(data.blamed_user_name) || "-",
    span: venueSpan(str(data.window_from) || null, str(data.window_to) || null) || "-",
  }).trim();

  const list = Array.isArray(data.items) ? (data.items as Array<{ name?: unknown; diff?: unknown; value?: unknown }>) : [];
  const named = list.slice(0, ITEMS_SHOWN).map((i) => fmt(t("notifications.stockShortageItem"), str(i.name), Math.abs(Number(i.diff) || 0)));
  const total = typeof data.items_total === "number" ? data.items_total : list.length;
  if (total > named.length && named.length > 0) named.push(fmt(t("notifications.stockShortageMore"), total - named.length));
  const items = named.length > 0 ? named.join(", ") : null;

  const g = data.gap as { from?: unknown; to?: unknown; notable?: unknown } | null | undefined;
  const gap = g && g.notable === true
    ? fmt(t("notifications.stockShortageGap"), venueSpan(str(g.from), null), venueSpan(str(g.to), null))
    : null;

  return { headline, body, items, gap };
};
