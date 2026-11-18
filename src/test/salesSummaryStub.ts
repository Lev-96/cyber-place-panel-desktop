import type { SalesQuery } from "@/api/salesSummary";

/** The working day the stubbed server says is running (tests only). */
export const STUB_TODAY = "2026-11-18";

/**
 * `/sales-summary` as a test's stub server answers it: the dates asked for
 * (or the running working day), counted over calendar days so a test can read
 * the hours it gets, and no money at all.
 */
export const salesSummaryStub = (_branchId: number, q: SalesQuery = {}) => {
  const from = q.date_from ?? STUB_TODAY;
  const to = q.date_to ?? from;
  return Promise.resolve({
    data: {
      branch_id: 1,
      window: {
        date_from: from, date_to: to, from: `${from}T00:00:00+04:00`, to: `${to}T23:59:59+04:00`,
        business_day: null, is_today: from === STUB_TODAY && to === STUB_TODAY, place_id: q.place_id ?? null, till_included: q.place_id == null,
      },
      totals: {
        grand_total: "0.00", places_total: "0.00", places_count: 0, places_free_count: 0, till_total: "0.00", till_count: 0,
        products_total: "0.00", products_units: 0, fast_food_total: "0.00", fast_food_units: 0,
      },
      by_method: [],
      drawer: { net_cash: "0.00" },
      products_rows: [],
      lines: [],
      lines_meta: { current_page: 1, last_page: 1, per_page: q.per_page ?? 100, total: 0 },
    },
  });
};
