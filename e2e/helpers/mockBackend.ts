import { Page, Route } from "@playwright/test";

/**
 * Intercept all backend traffic produced by the renderer so each E2E test
 * is deterministic and can run offline. Fixtures here mirror the real
 * Railway responses for the routes our scenarios touch — if the contract
 * changes, the mock changes here and the tests re-run.
 */

const BACKEND = "https://cyber-place-server-staging-production.up.railway.app";

export interface AuthFixture {
  role: "admin" | "company_owner" | "manager";
  name?: string;
  email?: string;
  branch_id?: number | null;
  company_id?: number;
}

/** Routes login + /user/me + a baseline empty list for everything else. */
export const installBackendMocks = async (
  page: Page,
  auth: AuthFixture = { role: "admin" },
) => {
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
  await page.route(`${BACKEND}/**`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { total: 0 } }),
    });
  });

  await page.route(`${BACKEND}/user/me`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { ...user, dashboard } }),
    });
  });

  await page.route(`${BACKEND}/session/login`, async (route: Route) => {
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
