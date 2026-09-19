import { Page, Route } from "@playwright/test";
import fs from "node:fs";
import * as d from "./demo";
import path from "node:path";

/**
 * The capture harness: a demo venue, served to the real bundle.
 *
 * It is the e2e mock idea taken one step further. `e2e/helpers/mockBackend`
 * answers every call with an empty list, which is what a TEST wants and the
 * opposite of what a SCREENSHOT wants: an empty table proves a screen renders
 * and sells nothing. So this file carries a venue — branches, seats, a busy
 * evening, a catalogue, bookings, a tournament — and hands each endpoint the
 * slice of it that endpoint owns.
 *
 * Nothing here touches a database or a running backend. The bundle is the real
 * built artefact; only the network is answered from this file, so a capture is
 * repeatable to the pixel and can run offline.
 */

export const SHOTS_DIR = "/home/developer/Documents/cyberplace-shots";

/** Where a capture lands, by app and name. */
export const shotPath = (app: string, name: string): string => {
  const dir = path.join(SHOTS_DIR, app);
  fs.mkdirSync(dir, { recursive: true });

  return path.join(dir, `${name}.png`);
};

const isBackend = (url: URL): boolean =>
  url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

/** One backend path, whatever host the bundle was built to talk to. */
export const onPath = (fragment: string) => (url: URL): boolean =>
  isBackend(url) && url.pathname.includes(fragment);

export const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

export type Role = "admin" | "company_owner" | "manager";
export type Lang = "hy" | "ru" | "en";

/**
 * Past the first-run language picker, then through the real login form.
 *
 * The token lives in `keyValueStore`, not in `localStorage`, so it cannot be
 * seeded from the outside — and driving the real form is better anyway: what
 * is captured afterwards is a session the app itself opened.
 */
export const signedIn = async (page: Page, role: Role, name: string, lang: Lang = "hy") => {
  const userId = role === "manager" ? 7 : 1;

  await page.addInitScript(([l, id]) => {
    if (window.localStorage.getItem("cp.lang.chosen") !== null) return;
    window.localStorage.setItem("cp.lang", JSON.stringify(l));
    window.localStorage.setItem("cp.lang.chosen", JSON.stringify(true));
    // The second gate: the account asks the language question again once it
    // signs in, and a modal over the cabinet is not a screenshot.
    window.localStorage.setItem(`u${id}:cp.lang`, JSON.stringify(l));
  }, [lang, String(userId)] as const);

  const user = {
    id: userId,
    name,
    email: role === "manager" ? "manager@cyberplace.pro" : "owner@cyberplace.pro",
    role,
    dashboard: {
      company_id: 1,
      branch_id: role === "manager" ? 1 : null,
      total_companies: 1,
      total_branches: 3,
      total_places: 42,
      total_bookings: 128,
      total_bookings_today: 14,
      upcoming_bookings: 9,
      active_branches: 3,
      all_places: 42,
      occupied_places_right_now: "27/42",
    },
  };

  // Registered first so the specific handlers below win: Playwright tries
  // handlers in reverse-registration order.
  await page.route(isBackend, (route) => json(route, { data: [], meta: { total: 0 } }));
  await page.route(onPath("/user/me"), (route) => json(route, { user }));
  await page.route(onPath("/session/login"), (route) =>
    json(route, { login: user, token: "demo-token", messages: "ok" }));

  return user;
};

/**
 * The login form, filled and submitted, then past the account's one-time
 * language prompt.
 *
 * The prompt is answered rather than seeded around: it reads the account scope
 * through the key-value store and is the app's real first-run step, so walking
 * it is both simpler and more honest than pre-writing the key it looks for.
 */
export const logIn = async (page: Page, lang: Lang = "hy") => {
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("owner@cyberplace.pro");
  await page.getByPlaceholder(/•/).fill("demo");
  await page.getByRole("button", { name: /Sign in|Մուտք|Войти/ }).click();
  await page.waitForTimeout(800);

  const names: Record<Lang, RegExp> = {
    hy: /Հայերեն/,
    ru: /Русский/,
    en: /English/,
  };
  const card = page.getByText(names[lang]).first();
  if (await card.isVisible().catch(() => false)) {
    await card.click();
    await page.getByRole("button", { name: /Continue|Շարունակել|Продолжить/ }).click();
    await page.waitForTimeout(600);
  }
};

/**
 * The demo venue, wired to the endpoints each screen reads.
 *
 * Registered after {@link signedIn} so these win over its empty-list
 * catch-all. The paths come from a probe run against the real bundle rather
 * than from reading the code, so a screen that quietly gained a call shows up
 * as an empty table in the capture instead of as a silent lie.
 */
export const demoVenue = async (page: Page) => {
  const list = (body: unknown[], total?: number) => ({ data: body, meta: { total: total ?? body.length } });

  const routes: Array<[string, unknown]> = [
    ["/branches/1/billing-settings", { settings: d.billingSettings }],
    ["/branch-platform-prices", list(d.platformPrices)],
    ["/branch-subplatforms", list([])],
    ["/time-packages", list(d.timePackages)],
    ["/session-events", list(d.sessionEvents)],
    ["/support/conversations", list(d.supportConversations)],
    ["/agent-updates/status", d.agentUpdateStatus],
    ["/company/1/billing", { billing: { status: "paid", next_due_at: null } }],
    ["/company/1", { company: d.company }],
    ["/company", list([d.company])],
    ["/products", list(d.products)],
    ["/managers", list(d.managers)],
    ["/tournaments", list(d.tournaments)],
    ["/bookings/1", { booking: d.bookings[0] }],
    ["/bookings", list(d.bookings)],
    ["/places", list(d.places)],
    ["/pcs", list(d.pcs)],
    ["/branches/1", { branch: d.branches[0] }],
    ["/branches", list(d.branches)],
  ];

  for (const [fragment, body] of routes) {
    await page.route(onPath(fragment), (route) => json(route, body));
  }

  // Sessions answer differently depending on what was asked for: the board
  // wants what is running, history wants what is finished.
  await page.route(onPath("/sessions"), (route) => {
    const url = new URL(route.request().url());
    const wantsActive = url.searchParams.get("status") === "active";

    return json(route, { data: wantsActive ? d.activeSessions : d.finishedSessions, meta: { total: 4 } });
  });
};

/** Everything has landed and nothing is still animating in. */
export const settle = async (page: Page, ms = 700) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);

  // Registered AFTER `/sessions` on purpose: both match
  // `/sessions/1/items/resolve`, and the later handler is the one Playwright
  // tries first. Registered before it, the board's list answered the box.
  await page.route(onPath("/items/resolve"), (route) => json(route, {
    resolved: {
      lines: [
        { raw: "20 lays", product_id: 5, name: "Lays", price: 700, qty: 20, line_total: 14000, error: null, candidates: [] },
        { raw: "30 cola", product_id: 1, name: "Coca-Cola", price: 500, qty: 30, line_total: 15000, error: null, candidates: [] },
      ],
      items: [{ product_id: 5, qty: 20 }, { product_id: 1, qty: 30 }],
      total: 29000,
      ok: true,
    },
  }));

};
