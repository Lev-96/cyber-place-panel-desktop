import { request } from "@/api/client";

/** One way money was taken, totalled (`GET /branches/{id}/sales-summary`, 2026-11-18). */
export interface ISalesMethodRow {
  /** cash | card | other | deposit | unrecorded */
  method: string;
  /** The name of a «Свой вариант» (Idram, «Hovo Card»); null otherwise. */
  label: string | null;
  amount: string;
  /** How many payments: a split bill counts once under each method it used. */
  count: number;
}

export interface ISalesPart {
  method: string;
  amount: string;
  label?: string;
}

/** One money record behind the totals: a closed place or a paid sale without a place. */
export interface ISalesLine {
  kind: "place" | "till";
  id: number;
  at: string | null;
  seat: string | null;
  place?: { id: number; number: number | null; name: string | null } | null;
  staff?: { id: number; name: string } | null;
  is_free: boolean;
  method: string | null;
  payments: ISalesPart[];
  amount: string;
  /** The cashier's comment on the payment (2026-11-18), or null. Absent from an older backend. */
  note?: string | null;
  /** Paid ahead at the start (a place), or null. */
  prepaid?: string | null;
}

/**
 * What `products_total` is made of (2026-11-18): one row per product and
 * price, the rows add up to it ON THE SERVER. `is_fast_food` / `partner_id`
 * are the catalogue's now.
 */
export interface ISalesProductRow {
  product_id: number | null;
  name: string;
  unit_price: string;
  quantity: number;
  total: string;
  is_fast_food: boolean;
  partner_id: number | null;
}

export interface ISalesSummary {
  branch_id: number;
  window: {
    date_from: string;
    date_to: string;
    from: string;
    to: string;
    /** The branch's hours the day is counted by ("13:00" → "07:00"); null: the calendar day. */
    business_day: { start: string; end: string } | null;
    is_today: boolean;
    /** The place asked for (2026-11-18), else null. */
    place_id?: number | null;
    /** False with a place: sales without a place (and tournaments) are not in it. */
    till_included?: boolean;
  };
  totals: {
    grand_total: string;
    places_total: string;
    places_count: number;
    places_free_count: number;
    till_total: string;
    till_count: number;
    products_total: string;
    products_units: number;
    /** Fast food, a part of the figures above (never added to them). Absent from an older backend. */
    fast_food_total?: string;
    fast_food_units?: number;
  };
  by_method: ISalesMethodRow[];
  drawer: { net_cash: string };
  /** Absent from an older backend. */
  products_rows?: ISalesProductRow[];
  lines: ISalesLine[];
  lines_meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface SalesQuery {
  /** Leave both out: the working day running now. */
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
  kind?: "place" | "till";
  method?: string;
  /** A «Свой вариант» name. */
  label?: string;
  /** Only «Другое» parts with no name (an empty `label` would not reach the server). */
  unnamed?: 1;
  /** One place's bills only (2026-11-18): no sale without a place, no tournament. */
  place_id?: number;
}

/** The figures are the server's, counted by the cash drawer's own code; the panel only shows them. */
export const apiSalesSummary = (branchId: number, q: SalesQuery): Promise<{ data: ISalesSummary }> =>
  // Never from a cache: money on this screen is read fresh every time.
  request<{ data: ISalesSummary }>(`/branches/${branchId}/sales-summary`, { params: q, noCache: true });
