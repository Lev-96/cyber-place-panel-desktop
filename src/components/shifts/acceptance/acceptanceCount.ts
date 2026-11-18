import { parseQuantity } from "@/components/products/stock";
import { formatVenueDate, formatVenueTime } from "@/i18n/dates";
import type { IAcceptanceProduct, IStockCountEntry, IStockCountRequiredBody } from "@/types/shifts";

/**
 * «Приём смены» (2026-11-18), pure: what the count form holds and what it
 * sends. The count is BLIND: nothing here knows, or could show, what the
 * books expect. Typed values are kept as text (empty = not counted yet,
 * which is not the same as 0).
 */

/** Typed text per product id. */
export type CountValues = Readonly<Record<number, string>>;

/** The products still without a whole number typed (empty or not a number). */
export const uncountedIds = (products: readonly IAcceptanceProduct[], values: CountValues): number[] =>
  products.filter((p) => parseQuantity(values[p.product_id] ?? "").kind !== "ok").map((p) => p.product_id);

/** A box holding something that is not a count (letters, a minus, too big). */
export const isInvalidCount = (raw: string | undefined): boolean => parseQuantity(raw ?? "").kind === "invalid";

/**
 * The body's `stock_counts`, in the list's order; null while any product is
 * not counted (the open is not offered then). An empty list gives [].
 */
export const stockCountsOf = (products: readonly IAcceptanceProduct[], values: CountValues): IStockCountEntry[] | null => {
  const out: IStockCountEntry[] = [];
  for (const p of products) {
    const q = parseQuantity(values[p.product_id] ?? "");
    if (q.kind !== "ok") return null;
    out.push({ product_id: p.product_id, counted: q.value });
  }
  return out;
};

/**
 * The list after a 422 `stock_count_required`: a product the server names
 * that this list did not have (it started being counted after the list was
 * read) is added, so it can be counted too.
 */
export const withMissing = (
  products: readonly IAcceptanceProduct[],
  refusal: IStockCountRequiredBody,
): IAcceptanceProduct[] => {
  const known = new Set(products.map((p) => p.product_id));
  const added = refusal.missing
    .filter((m) => !known.has(m.product_id))
    .map((m): IAcceptanceProduct => ({ product_id: m.product_id, name: m.name, category: null, is_active: true }));
  return [...products, ...added];
};

/** The products whose name or category holds the query (case-insensitive); all for an empty one. */
export const filterProducts = (products: readonly IAcceptanceProduct[], query: string): IAcceptanceProduct[] => {
  const q = query.trim().toLocaleLowerCase();
  if (q === "") return [...products];
  return products.filter((p) => p.name.toLocaleLowerCase().includes(q) || (p.category ?? "").toLocaleLowerCase().includes(q));
};

/** A search box is offered from this many products on. */
export const SEARCH_FROM = 8;

/** "17.11" on the venue's clock. */
export const venueDayMonth = (iso: string): string => formatVenueDate(iso).slice(0, 5);

/**
 * A span on the venue's clock: "17.11 10:00–12:00"; across midnight
 * "17.11 22:00–18.11 02:00"; with no end "17.11 10:00". The en dash is the
 * range mark (allowed; the em dash is not).
 */
export const venueSpan = (from: string | null | undefined, to: string | null | undefined): string => {
  if (!from) return to ? `${venueDayMonth(to)} ${formatVenueTime(to)}` : "";
  const start = `${venueDayMonth(from)} ${formatVenueTime(from)}`;
  if (!to) return start;
  const sameDay = formatVenueDate(from) === formatVenueDate(to);
  return `${start}–${sameDay ? "" : `${venueDayMonth(to)} `}${formatVenueTime(to)}`;
};

/** A moment beside another: its time when on the same venue day, else "17.11 03:12". */
export const venueMoment = (iso: string, reference: string | null | undefined): string =>
  reference && formatVenueDate(iso) === formatVenueDate(reference)
    ? formatVenueTime(iso)
    : `${venueDayMonth(iso)} ${formatVenueTime(iso)}`;
