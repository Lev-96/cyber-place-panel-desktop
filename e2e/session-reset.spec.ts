import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks } from "./helpers/mockBackend";

/**
 * "Reset the counter" (owner, 2026-11-05), on the real bundle and CSS: a ↺
 * beside the money on a running card that leaves the card its size, a
 * confirmation that says what happens, the card at 0 after it, and the
 * history saying who reset how much — set apart from the totals.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

const STARTED = new Date(Date.now() - 16 * 60_000).toISOString();
const running = {
  id: 5, branch_id: 1, pc_id: 1, pc_label: "PS5 1", mode: "open", status: "active",
  started_at: STARTED, ends_at: null, hourly_rate: 1500, total_paid: 0, is_free: false, is_unlimited: false,
  supports_joysticks: true, place_platform: "ps5", joystick_count: 2, joysticks: [], items: [],
};

const seedBoard = async (page: Page, role: "company_owner" | "manager" = "company_owner", over: Record<string, unknown> = {}) => {
  await installBackendMocks(page, { role, company_id: 1, branch_id: 1, name: "Owner One" });
  let current: Record<string, unknown> = { ...running, ...over };
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill(json({ data: [1, 2].map((n) => ({
    id: n, branch_id: 1, place_id: 10 + n, label: `PS5 ${n}`, kind: "ps", status: "online", is_startable: true,
    current_session_id: n === 1 ? 5 : null, place: { id: 10 + n, number: n, name: `Hall ${n}`, type: "standard", platform: "ps5" },
  })) })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions", (r) => r.fulfill(json({ data: [current] })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions/5/reset-time", (r) => {
    // As the server does: the raw clock at this instant becomes the offset.
    const clock = (Math.round(1500 * ((Date.now() - Date.parse(STARTED)) / 1000) / 3600 * 100) / 100).toFixed(2);
    current = { ...running, time_reset_at: new Date().toISOString(), time_reset_offset: clock, time_waived_total: clock };
    return r.fulfill(json({ session: current, waived: Number(clock) }));
  });
};

const signIn = async (page: Page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
};

test("the ↺ beside the money resets the counter after a clear confirmation; the card keeps its size", async ({ page }) => {
  await seedBoard(page);
  await signIn(page);
  await page.goto("/#/branches/1/sessions");
  const card = page.locator(".place-cell.session-card--running").first();
  const reset = card.locator('[data-action="reset-time"]');
  await expect(reset).toBeVisible();
  await expect(reset).toHaveAttribute("title", "Reset the counter");

  // The card is the same size with the ↺ as without it.
  const size = () => card.evaluate((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  const withIt = await size();
  await page.addStyleTag({ content: ".session-timer__reset { display: none !important; }" });
  const without = await size();
  expect(withIt).toEqual(without);
  await page.addStyleTag({ content: ".session-timer__reset { display: inline-flex !important; }" });

  await reset.click();
  const dialog = page.getByTestId("reset-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Reset the counter · №1");
  await expect(page.getByTestId("reset-amount")).toContainText(/^(40\d|39\d) AMD$/);
  await expect(dialog).toContainText("counts again from 0");
  await expect(dialog).toContainText("Saved in the history");

  await page.getByTestId("reset-confirm").click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/counter reset, .*waived/)).toBeVisible();
  // The card now counts from zero.
  const after = await card.locator(".session-timer__cost").innerText();
  expect(Number(after.replace(/[^\d.]/g, "")), after).toBeLessThan(2);
});

test("a manager may reset too", async ({ page }) => {
  await seedBoard(page, "manager");
  await signIn(page);
  await page.goto("/#/branches/1/sessions");
  await expect(page.locator('[data-action="reset-time"]').first()).toBeVisible();
});

test("goods alone are nothing to reset: no ↺ once the time is at 0", async ({ page }) => {
  // Reset a moment from now, so the clock reads 0 (and stays there while checked).
  const at = Date.now() + 60_000;
  const clock = (Math.round(1500 * ((at - Date.parse(STARTED)) / 1000) / 3600 * 100) / 100).toFixed(2);
  await seedBoard(page, "company_owner", {
    time_reset_at: new Date(at).toISOString(), time_reset_offset: clock, time_waived_total: clock,
    items: [{ id: 1, name: "Cola", price: 300, qty: 1 }],
  });
  await signIn(page);
  await page.goto("/#/branches/1/sessions");
  const card = page.locator(".place-cell.session-card--running").first();
  await expect(card.locator(".session-timer__cost")).toContainText("300");
  await expect(page.locator('[data-action="reset-time"]')).toHaveCount(0);
});

test("a free seat has nothing to reset: no ↺", async ({ page }) => {
  await seedBoard(page, "company_owner", { is_free: true });
  await signIn(page);
  await page.goto("/#/branches/1/sessions");
  await expect(page.locator(".place-cell.session-card--running").first()).toBeVisible();
  await expect(page.locator('[data-action="reset-time"]')).toHaveCount(0);
});

// The dialog reads the LIVE row (review, 2026-11-05): another desk's reset or
// stop while it is open is what it shows; nothing stale is confirmed.
test("the dialog follows the seat: reset elsewhere shows 0 and holds Confirm; stopped elsewhere closes it", async ({ page }) => {
  await page.clock.install();
  await installBackendMocks(page, { role: "company_owner", company_id: 1, branch_id: 1, name: "Owner One" });
  let list: Record<string, unknown>[] = [running];
  await page.route((u) => isBackend(u) && u.pathname === "/pcs", (r) => r.fulfill(json({ data: [1, 2].map((n) => ({
    id: n, branch_id: 1, place_id: 10 + n, label: `PS5 ${n}`, kind: "ps", status: "online", is_startable: true,
    current_session_id: n === 1 ? 5 : null, place: { id: 10 + n, number: n, name: `Hall ${n}`, type: "standard", platform: "ps5" },
  })) })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions", (r) => r.fulfill(json({ data: list })));
  await signIn(page);
  await page.goto("/#/branches/1/sessions");
  await page.locator('[data-action="reset-time"]').first().click();
  await expect(page.getByTestId("reset-confirm")).toBeEnabled();

  // Another cashier resets it: the board's 30 s read brings the new row.
  // Reset at the instant the read lands (31 s on), so the counter reads 0 then.
  const at = (await page.evaluate(() => Date.now())) + 31_000;
  const clock = (Math.round(1500 * ((at - Date.parse(STARTED)) / 1000) / 3600 * 100) / 100).toFixed(2);
  list = [{ ...running, time_reset_at: new Date(at).toISOString(), time_reset_offset: clock, time_waived_total: clock }];
  await page.clock.fastForward(31_000);
  await expect(page.getByTestId("reset-amount")).toHaveText(/^0(\.\d+)? AMD$/);
  await expect(page.getByTestId("reset-confirm")).toBeDisabled();

  // Then it is stopped elsewhere: gone from the board, the dialog closes.
  list = [];
  await page.clock.fastForward(31_000);
  await expect(page.getByTestId("reset-dialog")).toHaveCount(0);
});

// ── the history ──────────────────────────────────────────────────────
const T0 = Date.parse("2026-11-05T15:00:00Z");
const iso = (m: number) => new Date(T0 + m * 60_000).toISOString();
const owner = { id: 1, name: "Owner One", role: "company_owner" };
const closed = {
  ...running, status: "stopped", started_at: iso(0), stopped_at: iso(26), ends_at: null,
  total_paid: 550, payment_method: "cash", time_reset_at: iso(16), time_reset_offset: "400.00", time_waived_total: "400.00",
  items: [{ id: 1, name: "Cola", price: 300, qty: 1 }], opened_by_user_id: 1, stopped_by_user_id: 1,
};
const events = [
  { id: 1, session_id: 5, branch_id: 1, action: "started", amount: null, meta: { place_number: 1 }, created_at: iso(0), user: owner },
  { id: 2, session_id: 5, branch_id: 1, action: "item_added", amount: 300, meta: { name: "Cola", qty: 1, place_number: 1 }, created_at: iso(5), user: owner },
  { id: 3, session_id: 5, branch_id: 1, action: "time_reset", amount: 400, meta: { items_total: "300.00", joysticks_total: "0.00", place_number: 1 }, created_at: iso(16), user: owner },
  { id: 4, session_id: 5, branch_id: 1, action: "stopped", amount: 550, meta: { place_number: 1 }, created_at: iso(26), user: owner },
];
const seedHistory = async (page: Page) => {
  await installBackendMocks(page, { role: "company_owner", company_id: 1, branch_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/sessions", (r) => r.fulfill(json({ data: [closed] })));
  await page.route((u) => isBackend(u) && u.pathname === "/session-events", (r) => r.fulfill(json({ data: events })));
  await page.route((u) => isBackend(u) && u.pathname === "/session-events/actors", (r) => r.fulfill(json({ data: [owner] })));
  await page.route((u) => isBackend(u) && u.pathname === "/sessions/5/events", (r) => r.fulfill(json({ data: events })));
};
const openHistory = async (page: Page) => {
  await seedHistory(page);
  await signIn(page);
  await page.goto("/#/branches/1/sessions/history?from=2026-11-05&to=2026-11-05");
  await expect(page.getByText("Cola").first()).toBeVisible();
};

test("the history says who reset how much, apart from what was charged and from the total", async ({ page }) => {
  await openHistory(page);
  const step = page.locator(".hs-event.hs-tone-waive");
  await expect(step).toHaveCount(1);
  await expect(step.locator(".hs-event__title")).toHaveText("Reset the counter");
  await expect(step.locator(".hs-event__amount")).toHaveText("−400 AMD");
  await expect(step.locator(".hs-event__actor")).toHaveText("Owner One");
  await expect(step.locator(".hs-event__detail")).toContainText("300 AMD");
  await expect(page.locator('.hs-event__amount[data-kind="charge"]')).toHaveText("+300 AMD");
  await expect(page.locator('.hs-event__amount[data-kind="total"]')).toHaveText("Total: 550 AMD");

  // Each kind reads in its own colour; the total is the largest figure on the bill.
  const look = await page.evaluate(() => {
    const color = (sel: string) => getComputedStyle(document.querySelector(sel)!).color;
    const size = (sel: string) => parseFloat(getComputedStyle(document.querySelector(sel)!).fontSize);
    return {
      charge: color('.hs-event__amount[data-kind="charge"]'), waive: color('.hs-event__amount[data-kind="waive"]'),
      total: color('.hs-event__amount[data-kind="total"]'),
      title: size(".hs-event__title"), amount: size(".hs-event__amount"),
      billTotal: size(".hs-bill__total td"), billRow: size(".hs-bill__table tbody td.num"),
    };
  });
  expect(new Set([look.charge, look.waive, look.total]).size).toBe(3);
  expect(look.title).toBeGreaterThanOrEqual(15);
  expect(look.amount).toBeGreaterThanOrEqual(16);
  expect(look.billTotal).toBeGreaterThan(look.billRow);

  const waived = page.getByTestId("bill-waived");
  await expect(waived).toContainText("Reset");
  await expect(waived).toContainText("−400 AMD");
  // Both its cells in the warning colour, the same as the timeline's waiver.
  const colours = await page.evaluate(() => ({
    label: getComputedStyle(document.querySelector('[data-testid="bill-waived"] th')!).color,
    sum: getComputedStyle(document.querySelector('[data-testid="bill-waived"] td')!).color,
    waive: getComputedStyle(document.querySelector('.hs-event__amount[data-kind="waive"]')!).color,
  }));
  expect(colours.label).toBe(colours.waive);
  expect(colours.sum).toBe(colours.waive);
});
