import { Page, Route } from "@playwright/test";
import type { IPlatformBillingOverview } from "../../src/types/platformBilling";

/**
 * Intercept all backend traffic produced by the renderer so each E2E test
 * is deterministic and can run offline. Fixtures here mirror the real
 * Railway responses for the routes our scenarios touch — if the contract
 * changes, the mock changes here and the tests re-run.
 */

/**
 * Matched by PATH, not by host.
 *
 * This was pinned to the production Railway hostname, and the bundle these
 * specs run against resolves its API base from the environment — which has
 * since been the STAGING host. Every route therefore stopped matching, the
 * mocks silently did nothing, and the specs made real network calls whose
 * failures read as "wrong email or password". Nothing errored; the suite just
 * stopped testing anything.
 *
 * A glob on the path cannot drift with the environment, which is the point:
 * these fixtures are about the panel's behaviour, not about which deployment
 * it happens to be pointed at.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

/** Any backend call, whatever host the bundle was built to talk to. */
const anyBackendCall = (url: URL): boolean => isBackend(url);

/** One backend path, host-independent. */
const backendPath = (path: string) => (url: URL): boolean =>
  isBackend(url) && url.pathname === path;

export interface AuthFixture {
  role: "admin" | "company_owner" | "manager";
  name?: string;
  email?: string;
  branch_id?: number | null;
  company_id?: number;
}

/**
 * Answer the first-run language picker before the page loads.
 *
 * `FirstRunLanguageGate` renders a modal over the login screen on any machine
 * where nobody has ever chosen a language, and it deliberately has no dismiss —
 * a fresh install must not show a sign-in form in a language the user may not
 * read. A fresh browser context is exactly that machine, so every spec here was
 * clicking at a form behind an inert, blurred backdrop and timing out on a
 * "Sign in" button it could never reach.
 *
 * Seeding the device preference makes the context a RETURNING machine, which is
 * the state every one of these specs is actually about. `addInitScript` runs
 * before any application script, so the gate reads the value on its first pass
 * and never renders.
 *
 * The keys are `languagePreference.ts`'s own, written the way `KeyValueStore`
 * writes them in the browser: JSON, under the bare key.
 */
export const seedLanguageChosen = async (
  page: Page,
  lang: "en" | "ru" | "am" = "en",
  userId = 1,
) => {
  await page.addInitScript(([l, id]) => {
    // `addInitScript` runs on EVERY navigation, a reload included. Writing
    // unconditionally would put the seed back over a choice the spec had just
    // made — which is precisely what the "selection survives a reload" test is
    // about, so it would pass or fail on this helper rather than on the app.
    if (window.localStorage.getItem("cp.lang.chosen") !== null) return;

    window.localStorage.setItem("cp.lang", JSON.stringify(l));
    window.localStorage.setItem("cp.lang.chosen", JSON.stringify(true));
    // The SECOND gate. `AccountLanguageGate` asks the same question again once
    // an account signs in, so seeding only the device key gets a spec past the
    // login screen and straight into an identical modal over the cabinet —
    // which is why the post-login specs kept failing after the first fix.
    window.localStorage.setItem(`u${id}:cp.lang`, JSON.stringify(l));
  }, [lang, String(userId)] as const);
};

/**
 * `GET /company/{id}/platform-billing` as `PlatformBillingOverviewResource`
 * answers it for a company that was never invoiced: nothing owed, no open
 * invoice, access active, this month's estimate at zero.
 */
export const platformBillingOverview = (companyId: number): IPlatformBillingOverview => {
  const now = new Date();
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  return {
    company_id: companyId,
    currency: "AMD",
    commission_percent: "5.00",
    current_period: {
      start: ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
      end: ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))),
      gross_amount: "0.00",
      commission_amount: "0.00",
      is_estimate: true,
    },
    outstanding_amount: "0.00",
    open_invoice: null,
    next_due_on: null,
    billing_state: null,
    billing_access: "active",
    days_overdue: 0,
  };
};

/** Routes login + /user/me + a baseline empty list for everything else. */
export const installBackendMocks = async (
  page: Page,
  auth: AuthFixture = { role: "admin" },
) => {
  // Every spec that mocks the backend wants a machine that is already past the
  // first-run picker. A spec that genuinely tests the picker seeds nothing and
  // does not call this.
  await seedLanguageChosen(page);

  const user = {
    id: 1,
    name: auth.name ?? "Test User",
    email: auth.email ?? "test@example.com",
    role: auth.role,
  };
  const dashboard = {
    branch_id: auth.branch_id ?? null,
    company_id: auth.company_id ?? 1,
    total_companies: 0,
    total_branches: 0,
    total_places: 0,
    total_bookings_today: 0,
    upcoming_bookings: 0,
    occupied_places_right_now: "0/0",
  };

  // Playwright tries route handlers in reverse-registration order, so we
  // register the catch-all FIRST and the specific handlers last —
  // specific routes win that way.
  await page.route(anyBackendCall, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { total: 0 } }),
    });
  });

  // The owner's dashboard reads `GET /company/{id}/platform-billing`
  // (PlatformDebtCard). The catch-all's `{data: []}` has no `current_period`,
  // so the card threw and the owner's Home came up blank: every owner sign-in
  // spec failed at "Owner One" visible. Answered here with the backend's
  // `PlatformBillingOverviewResource` shape for a company never invoiced and
  // owing nothing (2026-11-14). A spec that wants "no platform billing"
  // registers its own 404 after this and wins.
  await page.route((url) => isBackend(url) && /^\/company\/\d+\/platform-billing$/.test(url.pathname), async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(platformBillingOverview(dashboard.company_id)),
    });
  });

  // «История продаж» reads its figures from `GET /branches/{id}/sales-summary`
  // (2026-11-18). A day with sales, in the backend's SalesSummaryResource
  // shape; a spec that wants other figures registers its own after this.
  await page.route((url) => isBackend(url) && /^\/branches\/\d+\/sales-summary$/.test(url.pathname), async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(salesSummary(new URL(route.request().url()))),
    });
  });

  // «Мои партнёры» (2026-11-18): the month's settlement of a company with no
  // partner and nothing sold, in PartnerSettlementResource's shape. The
  // catch-all's `{data: []}` already answers the partner list (none).
  await page.route((url) => isBackend(url) && /^\/companies\/\d+\/partners\/settlement$/.test(url.pathname), async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptySettlement(new URL(route.request().url()))),
    });
  });

  // «Приём смены» (2026-11-18): a branch that counts no product, in the
  // backend's `{data: [...]}` shape, so opening a shift opens at once (still
  // sending `stock_counts: []`). A spec that counts registers its own list.
  await page.route((url) => isBackend(url) && url.pathname === "/shifts/acceptance-products", async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) });
  });

  await page.route(backendPath("/user/me"), async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { ...user, dashboard } }),
    });
  });

  await page.route(backendPath("/session/login"), async (route: Route) => {
    const body = route.request().postDataJSON?.() ?? {};
    if (body?.password === "wrong") {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ errors: { email: ["Invalid"] } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        login: user,
        token: "test-token",
        messages: "ok",
      }),
    });
  });
};

/** An empty month as `/companies/{id}/partners/settlement` sends it (2026-11-18). */
export const emptySettlement = (url: URL) => ({
  data: {
    company_id: Number(url.pathname.split("/")[2]),
    month: url.searchParams.get("month") ?? "2026-11",
    branch_id: url.searchParams.get("branch_id") === null ? null : Number(url.searchParams.get("branch_id")),
    windows: [],
    terms_note: "",
    partners: [],
    own: { sales_total: "0.00", units: 0, rows: [] },
    totals: { sales_total: "0.00", units: 0, club_share: "0.00", partner_share: "0.00", fast_food_total: "0.00", fast_food_units: 0 },
  },
});

/**
 * A working day's figures as `/sales-summary` sends them (2026-11-18), with
 * the fast-food breakdown, the products it is made of, each line's comment,
 * and `?place_id=` (that place's bills only, no sale without a place).
 */
export const salesSummary = (url: URL) => {
  const from = url.searchParams.get("date_from") ?? "2026-11-18";
  const to = url.searchParams.get("date_to") ?? from;
  const placeId = url.searchParams.get("place_id") === null ? null : Number(url.searchParams.get("place_id"));
  // One person (2026-11-20): echoed, as the server does; their lines only.
  const staffId = url.searchParams.get("staff_user_id") === null ? null : Number(url.searchParams.get("staff_user_id"));
  const all = [
    { kind: "place", id: 5, at: "2026-11-18T15:10:00+04:00", seat: "№3", place: { id: 3, number: 3, name: null }, staff: { id: 2, name: "Anna" }, is_free: false, method: "split",
      payments: [{ method: "cash", amount: "2000.00" }, { method: "other", amount: "3000.00", label: "Hovo Card" }], amount: "5000.00", note: null },
    { kind: "place", id: 6, at: "2026-11-18T17:00:00+04:00", seat: "№4", place: { id: 4, number: 4, name: null }, staff: { id: 2, name: "Anna" }, is_free: false, method: "card",
      payments: [{ method: "card", amount: "4000.00" }], amount: "4000.00", note: "Card of Aram" },
    { kind: "till", id: 9, at: "2026-11-18T18:30:00+04:00", seat: null, place: null, staff: { id: 2, name: "Anna" }, is_free: false, method: "cash",
      payments: [{ method: "cash", amount: "1500.00" }], amount: "1500.00", note: null },
  ];
  const lines = (placeId === null ? all : all.filter((l) => l.place?.id === placeId))
    .filter((l) => staffId === null || l.staff?.id === staffId);
  const kind = url.searchParams.get("kind");
  const method = url.searchParams.get("method");
  const label = url.searchParams.get("label");
  const shown = lines.filter((l) => (kind === null || l.kind === kind)
    && (method === null || l.payments.some((p) => p.method === method && (label === null || ((p as { label?: string }).label ?? "") === label))));
  // One place: its own bill only (the server's figures for it, written out here).
  if (placeId !== null) {
    return {
      data: {
        branch_id: 1,
        window: { date_from: from, date_to: to, from: `${from}T07:00:00+04:00`, to: `${to}T07:00:00+04:00`, business_day: { start: "13:00", end: "07:00" }, is_today: from === to, place_id: placeId, till_included: false, staff_user_id: staffId },
        totals: { grand_total: "4000.00", places_total: "4000.00", places_count: 1, places_free_count: 0, till_total: "0.00", till_count: 0, products_total: "1500.00", products_units: 1, fast_food_total: "1500.00", fast_food_units: 1 },
        by_method: [
          { method: "cash", label: null, amount: "0.00", count: 0 },
          { method: "card", label: null, amount: "4000.00", count: 1 },
        ],
        drawer: { net_cash: "0.00" },
        products_rows: [{ product_id: 21, name: "Burger", unit_price: "1500.00", quantity: 1, total: "1500.00", is_fast_food: true, partner_id: 7 }],
        lines: shown,
        lines_meta: { current_page: 1, last_page: 1, per_page: 100, total: shown.length },
      },
    };
  }
  return {
    data: {
      branch_id: 1,
      window: { date_from: from, date_to: to, from: `${from}T07:00:00+04:00`, to: `${to}T07:00:00+04:00`, business_day: { start: "13:00", end: "07:00" }, is_today: from === to, place_id: null, till_included: true, staff_user_id: staffId },
      totals: { grand_total: "10500.00", places_total: "9000.00", places_count: 2, places_free_count: 0, till_total: "1500.00", till_count: 1, products_total: "4000.00", products_units: 4, fast_food_total: "3000.00", fast_food_units: 2 },
      by_method: [
        { method: "cash", label: null, amount: "3500.00", count: 2 },
        { method: "card", label: null, amount: "4000.00", count: 1 },
        { method: "other", label: "Hovo Card", amount: "3000.00", count: 1 },
      ],
      drawer: { net_cash: "3500.00" },
      products_rows: [
        { product_id: 21, name: "Burger", unit_price: "1500.00", quantity: 2, total: "3000.00", is_fast_food: true, partner_id: 7 },
        { product_id: 22, name: "Cola", unit_price: "500.00", quantity: 2, total: "1000.00", is_fast_food: false, partner_id: null },
      ],
      lines: shown,
      lines_meta: { current_page: 1, last_page: 1, per_page: 100, total: shown.length },
    },
  };
};

