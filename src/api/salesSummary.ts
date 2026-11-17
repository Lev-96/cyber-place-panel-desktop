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
  };
  by_method: ISalesMethodRow[];
  drawer: { net_cash: string };
  lines: ISalesLine[];
  lines_meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface SalesQuery {
  date_from: string;
  date_to: string;
  page?: number;
  per_page?: number;
  kind?: "place" | "till";
  method?: string;
  /** "" = an unnamed «Другое». */
  label?: string;
}

/** The figures are the server's, counted by the cash drawer's own code; the panel only shows them. */
export const apiSalesSummary = (branchId: number, q: SalesQuery): Promise<{ data: ISalesSummary }> =>
  // Never from a cache: money on this screen is read fresh every time.
  request<{ data: ISalesSummary }>(`/branches/${branchId}/sales-summary`, { params: q, noCache: true });
