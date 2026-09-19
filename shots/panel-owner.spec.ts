import { test } from "@playwright/test";
import { demoVenue, logIn, settle, shotPath, signedIn } from "./harness";

/**
 * The owner's screens, captured against the demo venue.
 *
 * One `test` per screen rather than one long walk: a screen that breaks takes
 * its own capture down and leaves the other nineteen intact.
 */
const owner = async (page: import("@playwright/test").Page) => {
  await signedIn(page, "company_owner", "Արամ Հովհաննիսյան");
  await demoVenue(page);
  await logIn(page);
};

const shot = async (page: import("@playwright/test").Page, route: string, name: string, wait = 900) => {
  await page.goto(`/#${route}`);
  await settle(page, wait);
  await page.screenshot({ path: shotPath("panel", name) });
};

test("owner: home", async ({ page }) => { await owner(page); await shot(page, "/", "owner-home"); });
test("owner: branches", async ({ page }) => { await owner(page); await shot(page, "/branches", "owner-branches"); });
test("owner: map", async ({ page }) => { await owner(page); await shot(page, "/branches-map", "owner-map", 2500); });
test("owner: branch hub", async ({ page }) => { await owner(page); await shot(page, "/branches/1", "owner-branch-hub"); });
test("owner: live floor", async ({ page }) => { await owner(page); await shot(page, "/branches/1/live", "owner-live"); });
test("owner: places", async ({ page }) => { await owner(page); await shot(page, "/branches/1/places", "owner-places"); });
test("owner: sessions", async ({ page }) => { await owner(page); await shot(page, "/branches/1/sessions", "owner-sessions"); });
test("owner: history", async ({ page }) => { await owner(page); await shot(page, "/branches/1/sessions/history", "owner-history"); });
test("owner: devices", async ({ page }) => { await owner(page); await shot(page, "/branches/1/pcs", "owner-devices"); });
test("owner: tariffs", async ({ page }) => { await owner(page); await shot(page, "/branches/1/tariffs", "owner-tariffs"); });
test("owner: products", async ({ page }) => { await owner(page); await shot(page, "/branches/1/products", "owner-products"); });
test("owner: managers", async ({ page }) => { await owner(page); await shot(page, "/branches/1/managers", "owner-managers"); });
test("owner: tournaments", async ({ page }) => { await owner(page); await shot(page, "/branches/1/tournaments", "owner-tournaments"); });
test("owner: bookings", async ({ page }) => { await owner(page); await shot(page, "/bookings", "owner-bookings"); });
test("owner: booking detail", async ({ page }) => { await owner(page); await shot(page, "/bookings/1", "owner-booking-detail"); });
test("owner: revenue", async ({ page }) => { await owner(page); await shot(page, "/revenue", "owner-revenue"); });
test("owner: my company", async ({ page }) => { await owner(page); await shot(page, "/my-company", "owner-company"); });
test("owner: support", async ({ page }) => { await owner(page); await shot(page, "/support", "owner-support"); });
test("owner: settings", async ({ page }) => { await owner(page); await shot(page, "/settings", "owner-settings"); });
test("owner: agent updates", async ({ page }) => { await owner(page); await shot(page, "/settings/agent-updates", "owner-agent-updates"); });
