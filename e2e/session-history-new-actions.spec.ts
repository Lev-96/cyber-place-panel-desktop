import { expect, test, type Page } from "@playwright/test";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, owner, runningSession, shot, signIn, type Lang } from "./helpers/moneySession";

/**
 * Sessions → History reads every audit row the backend writes since
 * 2026-11-15 (by amount, paid ahead, change / due, unpaid lines, keep the
 * rate, reminders) in words, in en / ru / am, with no raw "history.action.x"
 * and no em dash; the bill shows paid ahead, the server's change and what was
 * left owing. Meta shapes are the backend's (decimal strings in meta).
 */

const T0 = Date.parse("2026-11-15T14:00:00Z");
const iso = (m: number) => new Date(T0 + m * 60_000).toISOString();
const ev = (id: number, action: string, m: number, amount: number | null, meta: Record<string, unknown>, user: typeof owner | null = owner) =>
  ({ id, session_id: 5, branch_id: 1, action, amount, meta: { place_number: 3, ...meta }, created_at: iso(m), user });

const events = [
  ev(1, "started", 0, 2000, { mode: "fixed", is_free: false, planned_minutes: 120, hourly_rate: 1000, planned_amount: 2000, prepaid_amount: "2000.00", prepaid_method: "cash" }),
  ev(2, "item_added", 5, 1800, { count: 2, unpaid_total: 1200, lines: [
    { name: "Cola", price: 600, qty: 1, extra: false, hourly: false, unpaid: false },
    { name: "Cola", price: 600, qty: 2, extra: false, hourly: false, unpaid: true },
  ] }),
  ev(3, "reminder_set", 6, null, { minutes: 120, remind_at: iso(126), note: "Арам", previous_remind_at: null, previous_minutes: null, previous_note: null, previous_fired_at: null }),
  ev(4, "made_unlimited", 30, null, { old_mode: "fixed", hourly_rate: 1000, rate_source: "kept", rate_before: 1000, rate_now: { seat: 1000, pads: 500, extras: 0, total: 1500 } }),
  ev(5, "unpaid_off", 40, 1200, { scope: "item", item: { id: 9, name: "Cola", qty: 2, price: 600, line_total: 1200 }, merged_into: 8, unpaid_items_left: 0 }),
  ev(6, "reminder_fired", 126, null, { notified: 3, remind_at: iso(126), minutes: 120, note: "Арам", set_by_user_id: 1 }, null),
  ev(7, "reminder_cleared", 127, null, { fired: true, remind_at: iso(126), minutes: 120, note: "Арам" }),
  ev(8, "brand_new_action", 128, null, { note: "x" }),
  ev(9, "stopped", 130, 1500, { payment_method: "cash", payments: [{ method: "cash", amount: "1500.00" }], prepaid_amount: "2000.00", change: "500.00", due: "0.00", cash_received: "2000.00" }),
];

const closed = runningSession({
  status: "stopped", mode: "fixed", is_unlimited: false, started_at: iso(0), stopped_at: iso(130), ends_at: null, total_paid: 1500,
  payment_method: "cash", payments: [{ method: "cash", amount: 1500 }], prepaid_amount: 2000, cash_received: 2000, cash_change: 500,
  items: [{ id: 8, name: "Cola", price: 600, qty: 1, product_id: 1, unpaid_at: null }], opened_by_user_id: 1, stopped_by_user_id: 1,
});

const openHistory = async (page: Page, lang: Lang, width: number) => {
  await signIn(page, lang, width);
  await page.route(at("/sessions"), (r) => r.fulfill(json({ data: [closed] })));
  await page.route(at("/session-events"), (r) => r.fulfill(json({ data: events })));
  await page.route(at("/session-events/actors"), (r) => r.fulfill(json({ data: [owner] })));
  await page.route(at("/sessions/5/events"), (r) => r.fulfill(json({ data: events })));
  await page.goto("/#/branches/1/sessions/history?from=2026-11-15&to=2026-11-15");
  await expect(page.locator(".hs-event").first()).toBeVisible();
  // Unfold the middle when the card folded it.
  const more = page.locator("button.hs-more");
  if (await more.count()) await more.first().click();
};

const EXPECT: Record<Lang, { change: string; kept: string; reminder: string; fired: string; paid: string }> = {
  en: { change: "· Change", kept: "Price kept", reminder: "Set a reminder", fired: "The reminder rang", paid: "Marked as paid" },
  ru: { change: "Сдача", kept: "Цена прежняя", reminder: "Поставил напоминание", fired: "Сработало напоминание", paid: "Отметил оплату товара" },
  am: { change: "Մանր", kept: "Գինը նույնն է", reminder: "Դրեց հիշեցում", fired: "Հիշեցումը աշխատեց", paid: "Նշեց ապրանքի վճարումը" },
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`history: new actions read in words (${lang}, ${width})`, async ({ page }) => {
      await openHistory(page, lang, width);
      const timeline = page.locator(".hs-event");
      await expect(timeline.filter({ hasText: EXPECT[lang].reminder })).toHaveCount(1);
      await expect(timeline.filter({ hasText: EXPECT[lang].fired })).toHaveCount(1);
      await expect(timeline.filter({ hasText: EXPECT[lang].paid })).toHaveCount(1);
      await expect(timeline.filter({ hasText: EXPECT[lang].kept })).toHaveCount(1);
      await expect(page.locator("main").getByText("Brand new action")).toBeVisible();
      await expect(page.locator("main")).toContainText(EXPECT[lang].change);
      await noRawKeys(page, "main");
      // The bill: paid ahead, and the SERVER's change.
      await expect(page.getByTestId("bill-prepaid").first()).toContainText("2");
      await expect(page.getByTestId("bill-change").first()).toContainText("500");
      await shot(page, `history-new-actions-${lang}-${width}`);
      await fitsWidth(page, "main .hs-card, main .hs-bill");
    });
  }
}
