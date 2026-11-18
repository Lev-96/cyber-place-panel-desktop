import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, runningSession, seedBoard, signIn, type Lang } from "./helpers/moneySession";

/**
 * Every payment carries its way of paying (2026-11-18, owner). The Stop
 * receipt preselects nothing and its confirm waits for a method; a seat that
 * ended by itself while no board was open is found on the board's mount and
 * its receipt cannot be closed until the payment is recorded.
 */

const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/mandatory-method-2026-11-18/shots");
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

const HINT: Record<Lang, string> = { en: "Choose how it was paid", ru: "Выберите способ оплаты", am: "Ընտրեք վճարման եղանակը" };

const preview = (total: number) => ({
  mode: "open", is_free: false, is_unlimited: true, elapsed_minutes: 60, time_cost: total, hourly_rate: 1000, package_name: null,
  items: [], items_total: 0, unpaid_items_total: 0, joysticks: [], joysticks_total: 0, subtotal: total, gross_total: total, total,
  priced_at: new Date().toISOString(), prepaid: null,
});

/** A seat the clock ended an hour ago, nobody at the till: no method on record. */
const endedUnpaid = () => runningSession({
  id: 7, pc_id: 4, pc_label: "PS5 4", status: "expired", total_paid: 1500,
  started_at: new Date(Date.now() - 2 * 3600_000).toISOString(), stopped_at: new Date(Date.now() - 3600_000).toISOString(),
  payment_method: null, payments: [], cancelled_at: null,
});

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`stop: nothing preselected, the confirm waits for a method (${lang}, ${width})`, async ({ page }) => {
      let stopBody: unknown = null;
      await signIn(page, lang, width);
      await seedBoard(page, { session: () => runningSession() });
      await page.route(at("/sessions/5/preview"), (r) => r.fulfill(json({ preview: preview(1000) })));
      await page.route(at("/sessions/5/stop"), (r) => {
        stopBody = r.request().postDataJSON();
        return r.fulfill(json({ session: runningSession({ status: "stopped", total_paid: 1000, payment_method: "card" }), breakdown: preview(1000), cash: null }));
      });
      await openBoard(page);
      await page.locator('[data-action="stop"]').first().click();

      const confirm = page.getByTestId("stop-confirm");
      await expect(confirm).toBeDisabled();
      await expect(page.getByTestId("pay-choose-method")).toHaveText(HINT[lang]);
      for (const m of ["cash", "card", "other", "split"]) {
        await expect(page.getByTestId(`pay-${m}`)).toHaveAttribute("aria-checked", "false");
      }
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[role=dialog]");
      await shot(page, `stop-needs-method-${lang}-${width}`);

      await page.getByTestId("pay-card").click();
      await expect(page.getByTestId("pay-choose-method")).toHaveCount(0);
      await expect(confirm).toBeEnabled();
      await shot(page, `stop-method-chosen-${lang}-${width}`);
      await confirm.click();
      await expect.poll(() => stopBody).toMatchObject({ payment_method: "card" });
    });

    test(`a seat that ended unpaid while no board was open: asked on mount, not closable until recorded (${lang}, ${width})`, async ({ page }) => {
      let markBody: unknown = null;
      await signIn(page, lang, width);
      await seedBoard(page, { session: () => runningSession() });
      // The board's live list answers running seats; the look back (no
      // `status`, a `from`) answers the seat that ended unpaid.
      await page.route(at("/sessions"), (r: Route) => {
        if (r.request().method() !== "GET") return r.fallback();
        const q = new URL(r.request().url()).searchParams;
        return r.fulfill(json({ data: q.get("status") === "active" ? [runningSession()] : [runningSession(), endedUnpaid()] }));
      });
      await page.route(at("/sessions/7/preview"), (r) => r.fulfill(json({ preview: preview(1500) })));
      await page.route(at("/sessions/7/payment"), (r) => {
        markBody = r.request().postDataJSON();
        return r.fulfill(json({ session: { ...endedUnpaid(), payment_method: "cash" }, cash: null }));
      });
      await openBoard(page);

      const mark = page.getByTestId("pay-mark-confirm");
      await expect(mark).toBeVisible();
      await expect(mark).toBeDisabled();
      await expect(page.getByTestId("pay-mark-note")).toBeVisible();
      await expect(page.getByTestId("pay-choose-method")).toHaveText(HINT[lang]);
      await expect(page.locator(".cp-modal-close")).toHaveCount(0);
      await expect(page.locator(".receipt-actions button")).toHaveCount(1);
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[role=dialog]");
      await shot(page, `ended-unpaid-${lang}-${width}`);

      // Escape and a backdrop click do not close it.
      await page.keyboard.press("Escape");
      await page.mouse.click(5, 5);
      await page.waitForTimeout(300);
      await expect(mark).toBeVisible();

      await page.getByTestId("pay-cash").click();
      await expect(mark).toBeEnabled();
      await mark.click();
      await expect.poll(() => markBody).toMatchObject({ payment_method: "cash" });
      await expect(page.getByTestId("pay-mark-done")).toBeVisible();
      await expect(page.locator(".cp-modal-close")).toHaveCount(1);
      await shot(page, `ended-recorded-${lang}-${width}`);
      await page.locator(".receipt-actions button").click();
      await expect(page.getByTestId("pay-mark-done")).toHaveCount(0);
    });
  }
}
