import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, runningSession, seedBoard, signIn, type Lang } from "./helpers/moneySession";

/**
 * Billing audit 2026-11-16, what a cashier sees.
 *
 * 1. The card prints the cents the server stores on a branch that does not
 *    round (step 0): a seat at 833.34/h, 90 min played (paused, so the figure
 *    holds still) is 1 250.01 — it printed "1 250". A branch rounding to the
 *    nearest 100 shows 1 300.
 * 2. A receipt confirmed after the sweep closed the seat (F7): the server
 *    refuses the old figure (422) and the receipt reads the banked bill
 *    (1 000), which the next confirm sends; or, when this person may not read
 *    the closed seat (403), the receipt says it was closed elsewhere and offers
 *    only Close.
 */

const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/billing-fixes-2026-11-16/panel");
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

/** 90 min played, then paused (no limit): the bill holds at 833.34 × 1.5 = 1250.01. */
const pausedSeat = (step: number) => {
  const pausedAt = new Date(Date.now() - 10 * 60_000).toISOString();
  return runningSession({
    started_at: new Date(Date.now() - 100 * 60_000).toISOString(),
    hourly_rate: "833.34", tariff_hourly_rate: 833.34,
    paused_at: pausedAt, pauses: [{ paused_at: pausedAt, resumed_at: null, auto_resume_at: null }],
    rounding_step: step, rounding_mode: "nearest",
  });
};

const CLOSED: Record<Lang, string> = {
  en: "The session was already closed elsewhere. Its bill is saved.",
  ru: "Сессию уже закрыли в другом месте. Счёт сохранён.",
  am: "Սեսիան արդեն փակվել է այլ տեղում։ Հաշիվը պահպանված է։",
};
const CLOSE: Record<Lang, string> = { en: "Close", ru: "Закрыть", am: "Փակել" };
const CHANGED = "The bill changed since it was shown. It has been read again: check it and confirm.";

/** A 60-min plan at 1000; the receipt drawn at 59:50 says 997.22. */
const plannedSeat = () => runningSession({
  mode: "fixed", is_unlimited: false, committed_amount: 1000,
  started_at: new Date(Date.now() - 3590_000).toISOString(),
  ends_at: new Date(Date.now() + 10_000).toISOString(),
  committed_until: new Date(Date.now() + 10_000).toISOString(),
});
const receipt = (total: number) => ({
  mode: "fixed", is_free: false, is_unlimited: false, elapsed_minutes: 59, time_cost: total, hourly_rate: 1000, package_name: null,
  items: [], items_total: 0, unpaid_items_total: 0, joysticks: [], joysticks_total: 0, subtotal: total, gross_total: total, total,
  priced_at: new Date().toISOString(), prepaid: null,
});

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`the card prints the cents of a step-0 bill (${lang}, ${width})`, async ({ page }) => {
      await signIn(page, lang, width);
      await seedBoard(page, { session: () => pausedSeat(0) });
      await openBoard(page);
      const cost = page.locator(".session-timer__cost").first();
      await expect(cost).toHaveText(/1[\s,.  ]?250[.,]01/);
      await noRawKeys(page, ".place-cell");
      await fitsWidth(page, ".place-cell");
      await shot(page, `tile-cents-${lang}-${width}`);
    });

    test(`a branch rounding to 100 shows the step (${lang}, ${width})`, async ({ page }) => {
      await signIn(page, lang, width);
      await seedBoard(page, { session: () => pausedSeat(100) });
      await openBoard(page);
      const cost = page.locator(".session-timer__cost").first();
      await expect(cost).toHaveText(/^1[\s,.  ]?300(?![.,]\d)/);
    });

    test(`a receipt confirmed after the sweep: the banked bill is read and confirmed (${lang}, ${width})`, async ({ page }) => {
      const stops: Record<string, unknown>[] = [];
      await signIn(page, lang, width);
      await seedBoard(page, { session: plannedSeat });
      let reads = 0;
      await page.route(at("/sessions/5/preview"), (r) => r.fulfill(json({ preview: receipt(reads++ === 0 ? 997.22 : 1000) })));
      await page.route(at("/sessions/5/stop"), (r) => {
        stops.push(r.request().postDataJSON());
        return stops.length === 1
          ? r.fulfill(json({ message: CHANGED }, 422))
          : r.fulfill(json({ session: runningSession({ status: "expired", total_paid: 1000 }), breakdown: receipt(1000), cash: null }));
      });
      await openBoard(page);
      await page.locator('[data-action="stop"]').first().click();
      await expect(page.getByRole("dialog")).toContainText(/997[.,]22/);
      await page.getByTestId("stop-confirm").click();
      await expect(page.getByRole("dialog")).toContainText(CHANGED);
      await expect(page.getByRole("dialog")).not.toContainText(/997[.,]22/);
      await expect(page.getByRole("dialog")).toContainText(/1[\s,.  ]?000/);
      await shot(page, `receipt-swept-reread-${lang}-${width}`);
      await page.getByTestId("stop-confirm").click();
      await expect.poll(() => stops.length).toBe(2);
      expect(stops[1]).toMatchObject({ expected_total: 1000 });
    });

    test(`a receipt for a seat closed elsewhere, not ours to read: reported, Close only (${lang}, ${width})`, async ({ page }) => {
      await signIn(page, lang, width, "manager");
      await seedBoard(page, { session: plannedSeat });
      let reads = 0;
      await page.route(at("/sessions/5/preview"), (r) => (reads++ === 0
        ? r.fulfill(json({ preview: receipt(997.22) }))
        : r.fulfill(json({ message: "This action is unauthorized." }, 403))));
      await page.route(at("/sessions/5/stop"), (r) => r.fulfill(json({ message: CHANGED }, 422)));
      await openBoard(page);
      await page.locator('[data-action="stop"]').first().click();
      await page.getByTestId("stop-confirm").click();
      await expect(page.getByTestId("checkout-ended-elsewhere")).toHaveText(CLOSED[lang]);
      await expect(page.getByRole("dialog")).not.toContainText(/997[.,]22/);
      await expect(page.getByTestId("stop-confirm")).toHaveCount(0);
      const actions = page.locator(".receipt-actions");
      await expect(actions.getByRole("button")).toHaveCount(1);
      await expect(actions.getByRole("button", { name: CLOSE[lang], exact: true })).toBeVisible();
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[role=dialog]");
      await shot(page, `receipt-closed-elsewhere-${lang}-${width}`);
    });
  }
}
