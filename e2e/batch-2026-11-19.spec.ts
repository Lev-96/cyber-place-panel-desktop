import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { t } from "../src/i18n/translations";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, runningSession, seedBoard, signIn, type Lang } from "./helpers/moneySession";

/**
 * Owner, 2026-11-19:
 *  - nothing chosen = cash: the Stop receipt starts on cash again (v1.0.66),
 *    the receipt of a seat that ended by itself closes without recording;
 *  - several «Свой вариант» in one «Разделить»: each part sent as
 *    `{method: "other", amount, label}`, a repeated name refused in words;
 *  - the «ending soon» popup names the seat by number AND name, larger;
 *  - a manager's OPEN shift shows only «Приём смены».
 *
 * Shapes assumed from the backend task of the same day (see CLAUDE.md
 * «Nothing chosen is cash; several own options…»).
 * en/ru/am × 1280/520: no raw key, no em dash, nothing wider than the window.
 */

const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/batch-2026-11-19/shots");
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

/** A seat of 5 000 by the hour (the preview the receipt reads). */
const preview = {
  mode: "open", is_free: false, is_unlimited: true, elapsed_minutes: 300, time_cost: 5000, hourly_rate: 1000, package_name: null,
  items: [], items_total: 0, unpaid_items_total: 0, joysticks: [], joysticks_total: 0, subtotal: 5000, gross_total: 5000, total: 5000,
  priced_at: new Date().toISOString(), prepaid: null,
};

const stopRoutes = async (page: Page, onStop: (body: Record<string, unknown>) => void) => {
  await page.route(at("/sessions/5/preview"), (r: Route) => r.fulfill(json({ preview })));
  await page.route(at("/branches/1/payment-labels"), (r: Route) => r.fulfill(json({ data: [{ label: "Telcell", uses: 3 }] })));
  await page.route(at("/sessions/5/stop"), (r: Route) => {
    onStop(r.request().postDataJSON() as Record<string, unknown>);
    return r.fulfill(json({ session: runningSession({ status: "stopped", total_paid: 5000, payment_method: "split" }), breakdown: preview, cash: null }));
  });
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`Stop: several own options in one split (${lang}, ${width})`, async ({ page }) => {
      const bodies: Record<string, unknown>[] = [];
      await signIn(page, lang, width);
      await seedBoard(page, { session: () => runningSession() });
      await stopRoutes(page, (b) => bodies.push(b));
      await openBoard(page);
      await page.locator('[data-action="stop"]').first().click();
      await expect(page.getByTestId("payment-editor")).toBeVisible();

      // Nothing chosen = cash, as in v1.0.66.
      await expect(page.getByTestId("pay-cash")).toHaveAttribute("aria-checked", "true");

      await page.getByTestId("pay-split").click();
      await page.getByLabel(t("session.payCash", lang), { exact: true }).and(page.locator("input")).fill("1000");
      // «+ Свой вариант»: Idram 1 500.
      await page.getByTestId("pay-own-add").click();
      const rows = page.getByTestId("pay-own-row");
      await rows.nth(0).getByTestId("pay-own-name").fill("Idram");
      await rows.nth(0).locator("input").nth(1).fill("1500");
      // A saved name is one press: Telcell, the rest.
      await page.getByTestId("pay-own-saved-Telcell").click();
      await expect(rows).toHaveCount(2);
      await rows.nth(1).getByTestId("pay-rest-other").click();
      await expect(page.getByTestId("pay-remaining")).toHaveText(t("pay.allPaid", lang));

      // A third row named like the first is refused on its row, in words.
      await page.getByTestId("pay-own-add").click();
      await rows.nth(2).getByTestId("pay-own-name").fill("IDRAM");
      await expect(page.getByTestId("pay-own-duplicate")).toHaveText(t("pay.ownDuplicate", lang));
      await fitsWidth(page, "[data-testid=payment-editor]");
      await shot(page, `stop-own-duplicate-${lang}-${width}`);
      await page.getByTestId("stop-confirm").click();
      await expect(page.locator("[role=dialog]").getByText(t("pay.ownDuplicate", lang)).first()).toBeVisible();
      expect(bodies).toHaveLength(0);
      await rows.nth(2).getByTestId("pay-own-remove").click();
      await expect(page.getByTestId("pay-own-duplicate")).toHaveCount(0);

      await fitsWidth(page, "[data-testid=payment-editor]");
      await noRawKeys(page, "[role=dialog]");
      await shot(page, `stop-own-several-${lang}-${width}`);

      await page.getByTestId("stop-confirm").click();
      await expect.poll(() => bodies.length).toBe(1);
      expect(bodies[0]).toMatchObject({
        payments: [
          { method: "cash", amount: 1000 },
          { method: "other", amount: 1500, label: "Idram" },
          { method: "other", amount: 2500, label: "Telcell" },
        ],
        expected_total: 5000,
      });
      expect(bodies[0]).not.toHaveProperty("payment_method");
    });

    test(`the «ending soon» popup: number and name, larger, inside the window (${lang}, ${width})`, async ({ page }) => {
      const notice = {
        id: "n-end-1", type: "App\\Notifications\\SessionEndingSoon", read_at: null, created_at: new Date().toISOString(),
        data: {
          type: "session.ending_soon", session_id: 5, branch_id: 1, pc_id: 3, place_id: 13, place_number: 3, place_name: "VIP Sofa",
          ends_at: new Date(Date.now() + 5 * 60_000).toISOString(), minutes_left: 5,
        },
      };
      await signIn(page, lang, width, "company_owner", async () => {
        await page.route(at("/notifications"), (r: Route) => r.fulfill(json({
          data: [notice], meta: { current_page: 1, last_page: 1, per_page: 50, total: 1, unread_count: 1 },
        })));
        await page.route(at("/notifications/unread-count"), (r: Route) => r.fulfill(json({ unread_count: 1 })));
      });
      await seedBoard(page, { session: () => runningSession() });
      await openBoard(page);

      const card = page.getByTestId("ending-soon-card");
      await expect(card).toBeVisible();
      await expect(page.getByTestId("ending-soon-seat")).toHaveText("№3 · VIP Sofa");
      await expect(card).toContainText(t("session.endingSoonLeft", lang).replace("{minutes}", "5"));
      // Larger: the seat line reads from across the counter.
      const seatSize = await page.getByTestId("ending-soon-seat").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(seatSize).toBeGreaterThanOrEqual(24);
      // Inside the screen, and a toast: the board under it still takes a press.
      const box = (await page.getByTestId("ending-soon-stack").boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(900);
      await fitsWidth(page, "[data-testid=ending-soon-stack]");
      await expect(page.locator("[aria-modal=true]")).toHaveCount(0);
      await noRawKeys(page, "[data-testid=ending-soon-stack]");
      await shot(page, `ending-soon-${lang}-${width}`);
    });

    test(`manager: the open shift shows only «Приём смены» (${lang}, ${width})`, async ({ page }) => {
      const SUMMARY = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/shift-stock-v6-summary.json"), "utf8")) as {
        shift: Record<string, unknown>;
        report: Record<string, unknown>;
      };
      const count = {
        blind: true, counted_at: "2026-11-19T10:05:00+04:00", counted_by: { id: 3, name: "Boris" },
        rows: [{ product_id: 1, name: "Cola", counted: 7 }, { product_id: 2, name: "Chips", counted: 6 }], count: 2,
      };
      await signIn(page, lang, width, "manager");
      await page.route(at("/shifts/current"), (r: Route) => r.fulfill(json({ shift: SUMMARY.shift, report: { ...SUMMARY.report, acceptance_count: count } })));
      await page.route(at("/shifts"), (r: Route) => r.fulfill(json({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } })));
      await page.route(at("/shifts/staff"), (r: Route) => r.fulfill(json({ data: [] })));
      await page.route(at("/branches/1"), (r: Route) => r.fulfill(json({ branch: { id: 1, address: "Abovyan 1", city: "Yerevan", company_id: 1 } })));
      await page.goto("/#/branches/1/shift");

      const report = page.getByTestId("shift-report");
      await expect(report).toBeVisible();
      await expect(page.getByTestId("shift-header")).toBeVisible();
      await expect(page.getByTestId("shift-acceptance")).toBeVisible();
      await expect(page.getByTestId("shift-acceptance")).toContainText("Cola");
      for (const id of ["shift-revenue-total", "shift-method-cash", "shift-cash-expected", "shift-stock", "shift-staff", "shift-handover", "shift-not-tracked", "shift-lines", "shift-warnings"]) {
        await expect(page.getByTestId(id), id).toHaveCount(0);
      }
      await expect(report).not.toContainText(t("shift.revenueTotal", lang));
      await expect(report).not.toContainText(t("shift.byMethod", lang));
      await expect(page.getByTestId("shift-close")).toBeVisible();
      await fitsWidth(page, "[data-testid=shift-report]");
      await noRawKeys(page, "[data-testid=shift-report]");
      await shot(page, `manager-open-shift-${lang}-${width}`);
    });
  }
}

test("till: two own options sell as two parts (ru, 520)", async ({ page }) => {
  const lang: Lang = "ru";
  let body: Record<string, unknown> | null = null;
  const cola = { id: 3, branch_id: 1, name: "Cola", price: "1000.00", is_active: true, kind: "regular" };
  await signIn(page, lang, 520);
  await page.route((u) => u.hostname !== "localhost" && u.pathname === "/products", (r) => r.fulfill(json({ data: [cola] })));
  await page.route(at("/branches/1/payment-labels"), (r: Route) => r.fulfill(json({ data: [] })));
  await page.route(at("/orders"), (r) => {
    if (r.request().method() !== "POST") return r.fulfill(json({ data: [] }));
    body = r.request().postDataJSON();
    return r.fulfill(json({ order: {
      id: 2, branch_id: 1, subtotal: 1000, total: 1000, payment_method: "split", payment_method_other: null, status: "paid",
      created_at: new Date().toISOString(), cash_received: null, change: null, cashier: null,
      items: [{ id: 1, product_name: "Cola", quantity: 1, unit_price: 1000, line_total: 1000 }],
      payments: [{ method: "other", amount: "400.00", note: null, label: "Idram" }, { method: "other", amount: "600.00", note: null, label: "Hovo Card" }],
    } }, 201));
  });
  await page.goto("/#/branches/1/pos");
  await page.getByRole("button", { name: t("till.sell", lang), exact: true }).click();
  await page.getByText(t("session.addModePicker", lang), { exact: true }).click();
  await page.getByLabel(`${t("action.add", lang)}: Cola`).click();
  await page.getByTestId("pay-split").click();
  await page.getByTestId("pay-own-add").click();
  await page.getByTestId("pay-own-add").click();
  const rows = page.getByTestId("pay-own-row");
  // Two without a name: the second is asked to take one.
  await expect(page.getByTestId("pay-own-duplicate")).toHaveText(t("pay.ownUnnamedTwice", lang));
  await rows.nth(0).getByTestId("pay-own-name").fill("Idram");
  await rows.nth(0).locator("input").nth(1).fill("400");
  await rows.nth(1).getByTestId("pay-own-name").fill("Hovo Card");
  await rows.nth(1).getByTestId("pay-rest-other").click();
  await expect(page.getByTestId("pay-remaining")).toHaveText(t("pay.allPaid", lang));
  await fitsWidth(page, "[data-testid=payment-editor]");
  await shot(page, "till-own-two-ru-520");
  await page.getByRole("button", { name: t("till.sellConfirm", lang), exact: true }).click();
  await expect.poll(() => body).toMatchObject({
    branch_id: 1,
    payments: [{ method: "other", amount: 400, label: "Idram" }, { method: "other", amount: 600, label: "Hovo Card" }],
  });
});
