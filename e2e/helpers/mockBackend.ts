import { Page, Route } from "@playwright/test";

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
