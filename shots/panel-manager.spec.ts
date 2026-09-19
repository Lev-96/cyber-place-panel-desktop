import { Page, test } from "@playwright/test";
import { demoVenue, logIn, settle, shotPath, signedIn } from "./harness";

/**
 * The manager's day, and the dialogs the owner's screens cannot show.
 *
 * A manager signs into one branch, so their captures start on the floor rather
 * than on a network overview. The dialogs below are the ones a video has to
 * show — starting a seat, taking money, selling a drink — and none of them is
 * reachable from a URL, so each capture opens it the way a cashier does.
 */
const manager = async (page: Page) => {
  await signedIn(page, "manager", "Նարե Սարգսյան");
  await demoVenue(page);
  await logIn(page);
};

const shot = async (page: Page, name: string) =>
  page.screenshot({ path: shotPath("panel", name) });

const go = async (page: Page, route: string, wait = 900) => {
  await page.goto(`/#${route}`);
  await settle(page, wait);
};

test("manager: live floor", async ({ page }) => {
  await manager(page); await go(page, "/branches/1/live"); await shot(page, "manager-live");
});

test("manager: sessions board", async ({ page }) => {
  await manager(page); await go(page, "/branches/1/sessions"); await shot(page, "manager-sessions");
});

test("manager: products", async ({ page }) => {
  await manager(page); await go(page, "/branches/1/products"); await shot(page, "manager-products");
});

test("manager: bookings", async ({ page }) => {
  await manager(page); await go(page, "/bookings"); await shot(page, "manager-bookings");
});

test("manager: support", async ({ page }) => {
  await manager(page); await go(page, "/support"); await shot(page, "manager-support");
});

/* ── The dialogs ────────────────────────────────────────────────────────── */

test("manager: add item, from the catalogue", async ({ page }) => {
  await manager(page);
  await go(page, "/branches/1/sessions");
  await page.getByRole("button", { name: /Ավելացնել ապրանք/ }).first().click();
  await settle(page, 800);
  await shot(page, "manager-add-item-picker");
});

test("manager: add item, typed", async ({ page }) => {
  await manager(page);
  await go(page, "/branches/1/sessions");
  await page.getByRole("button", { name: /Ավելացնել ապրանք/ }).first().click();
  await settle(page, 700);
  await page.getByText(/Մուտքագրել ցանկով/).click();
  await page.getByLabel(/Արագ մուտքագրում/).fill("20 lays\n30 cola");
  await settle(page, 1200);
  await shot(page, "manager-add-item-typed");
});

test("manager: session options", async ({ page }) => {
  await manager(page);
  await go(page, "/branches/1/sessions");
  await page.getByRole("button", { name: /Ավելացնել ժամանակ/ }).first().click();
  await settle(page, 800);
  await shot(page, "manager-session-options");
});

test("manager: stopping a seat", async ({ page }) => {
  await manager(page);
  await go(page, "/branches/1/sessions");
  await page.getByRole("button", { name: /^Կանգ$/ }).first().click();
  await settle(page, 900);
  await shot(page, "manager-stop-receipt");
});
