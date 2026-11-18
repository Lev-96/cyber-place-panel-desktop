import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fmt, t } from "../src/i18n/translations";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, signIn, type Lang } from "./helpers/moneySession";

/**
 * «Приём смены» (2026-11-18). The shapes are the backend's own
 * (`ShiftController::open`, `AcceptanceProductResource`,
 * `ShiftStockCountReport::block()` + `flow`, `NotifyOwnersOfStockShortage`):
 *
 *   - manager: Open → the blind count (no figure of the books), Open off until
 *     every product has a number, 422 `stock_count_required` outlines the
 *     missed product, the retry carries the SAME press id, toast after;
 *   - owner: the report's block (flow, books, count, difference, money,
 *     previous shift, gap, totals);
 *   - owner: the bell row reads as a sentence and opens `/shifts?shift_id=`.
 *
 * en/ru/am × 1280/520: no raw key, no em dash, nothing wider than the window.
 */

const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/shift-acceptance-2026-11-18/shots");
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};
const SUMMARY = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/shift-stock-v6-summary.json"), "utf8")) as {
  shift: Record<string, unknown>;
  report: Record<string, unknown>;
};
const MINUS = "−";

const PRODUCTS = [
  { product_id: 1, name: "Cola", category: "Drinks", is_active: true },
  { product_id: 2, name: "Chips", category: null, is_active: false },
];

/** The owner's block, as `report.acceptance_count` carries it (figures of the backend's test evening). */
const FULL_COUNT = {
  counted_at: "2026-11-18T12:30:00+04:00",
  counted_by: { id: 3, name: "Boris" },
  previous_shift: { id: 41, opened_at: "2026-11-17T10:00:00+04:00", closed_at: "2026-11-17T12:00:00+04:00", opened_by: { id: 2, name: "Anna" }, closed_by: { id: 2, name: "Anna" } },
  blamed_user: { id: 2, name: "Anna" },
  window: { from: "2026-11-17T10:00:00+04:00", to: "2026-11-17T12:00:00+04:00" },
  gap: { from: "2026-11-17T12:00:00+04:00", to: "2026-11-18T12:30:00+04:00", seconds: 88200, notable: true },
  rows: [
    { product_id: 2, name: "Chips", unit_price: "300.00", expected: 5, counted: 6, diff: 1, value: "300.00", outcome: "surplus", is_baseline: false,
      last_movement_at: null, last_sale_at: null, flow: { accepted: 5, received: 2, sold: 1, returned: 0, corrected: -1 } },
    { product_id: 1, name: "Cola", unit_price: "500.00", expected: 9, counted: 7, diff: -2, value: "1000.00", outcome: "shortage", is_baseline: false,
      last_movement_at: "2026-11-17T11:40:00+04:00", last_sale_at: "2026-11-17T11:40:00+04:00", flow: { accepted: 10, received: 0, sold: 1, returned: 0, corrected: 0 } },
    { product_id: 3, name: "Water", unit_price: "200.00", expected: 4, counted: 1, diff: -3, value: "600.00", outcome: "baseline", is_baseline: true,
      last_movement_at: null, last_sale_at: null, flow: { accepted: null, received: 4, sold: 0, returned: 0, corrected: 0 } },
  ],
  totals: { products: 3, baseline_products: 1, shortage_products: 1, shortage_units: 2, shortage_value: "1000.00", surplus_products: 1, surplus_units: 1, surplus_value: "300.00" },
};

const shiftRoutes = async (page: Page, current: () => unknown) => {
  await page.route(at("/shifts/current"), (r: Route) => r.fulfill(json(current())));
  await page.route(at("/shifts"), (r: Route) => r.fulfill(json({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } })));
  await page.route(at("/shifts/staff"), (r: Route) => r.fulfill(json({ data: [] })));
  await page.route(at("/branches/1"), (r: Route) => r.fulfill(json({ branch: { id: 1, address: "Abovyan 1", city: "Yerevan", company_id: 1 } })));
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`manager: the blind count opens the shift (${lang}, ${width})`, async ({ page }) => {
      await signIn(page, lang, width, "manager");
      let opened = false;
      const bodies: Array<Record<string, unknown>> = [];
      await shiftRoutes(page, () => (opened ? { shift: SUMMARY.shift, report: SUMMARY.report } : { shift: null, report: null }));
      await page.route(at("/shifts/acceptance-products"), (r: Route) => r.fulfill(json({ data: PRODUCTS })));
      await page.route(at("/shifts/open"), (r: Route) => {
        const body = r.request().postDataJSON() as Record<string, unknown>;
        bodies.push(body);
        if (bodies.length === 1) {
          return r.fulfill(json({ message: "Count every product", code: "stock_count_required", missing: [{ product_id: 3, name: "Water" }] }, 422));
        }
        opened = true;
        return r.fulfill(json({ shift: SUMMARY.shift, acceptance_count: { blind: true, counted_at: null, counted_by: null, rows: [], count: 3 } }, 201));
      });

      await page.goto("/#/branches/1/shift");
      await page.getByTestId("shift-open").click();

      const step = page.getByTestId("shift-accept");
      await expect(step).toBeVisible();
      await expect(step.locator("h2")).toHaveText(t("shift.accept.title", lang));
      await expect(step).toContainText(t("shift.accept.hint", lang));
      await expect(step).toContainText(t("product.exists.hidden", lang));
      await expect(page.getByTestId("shift-accept-row")).toHaveCount(2);
      await expect(page.getByTestId("shift-accept-open")).toBeDisabled();
      await expect(page.getByTestId("shift-accept-left")).toHaveText(fmt(t("shift.accept.left", lang), 2));
      await noRawKeys(page, "[data-testid=shift-accept]");
      await fitsWidth(page, "[data-testid=shift-accept]");
      await shot(page, `accept-step-${lang}-${width}`);

      const inputs = page.getByTestId("shift-accept-input");
      await inputs.nth(0).fill("7");
      await expect(page.getByTestId("shift-accept-open")).toBeDisabled();
      await inputs.nth(1).fill("0");
      await expect(page.getByTestId("shift-accept-open")).toBeEnabled();
      await page.getByTestId("shift-accept-open").click();

      // 422: Water was not in the list; it is added and outlined.
      const water = page.getByTestId("shift-accept-row").filter({ hasText: "Water" });
      await expect(water).toHaveClass(/is-missing/);
      await expect(page.getByTestId("shift-accept-error")).toHaveText(t("shift.accept.missing", lang));
      await expect(page.getByTestId("shift-accept-open")).toBeDisabled();
      await fitsWidth(page, "[data-testid=shift-accept]");
      await shot(page, `accept-missing-${lang}-${width}`);

      await water.getByTestId("shift-accept-input").fill("4");
      await page.getByTestId("shift-accept-open").click();
      await expect(page.getByText(t("toast.shift.accepted", lang))).toBeVisible();
      await expect(step).toHaveCount(0);

      expect(bodies).toHaveLength(2);
      expect(bodies[0]).toEqual({
        branch_id: 1, opening_cash: "0.00", client_request_id: expect.any(String),
        stock_counts: [{ product_id: 1, counted: 7 }, { product_id: 2, counted: 0 }],
      });
      expect(bodies[1].stock_counts).toEqual([{ product_id: 1, counted: 7 }, { product_id: 2, counted: 0 }, { product_id: 3, counted: 4 }]);
      expect(bodies[1].client_request_id).toBe(bodies[0].client_request_id);
    });

    test(`owner: the report's «Приём смены» (${lang}, ${width})`, async ({ page }) => {
      await signIn(page, lang, width);
      await shiftRoutes(page, () => ({ shift: SUMMARY.shift, report: { ...SUMMARY.report, acceptance_count: FULL_COUNT } }));
      await page.goto("/#/branches/1/shift");
      const block = page.getByTestId("shift-acceptance");
      await expect(block).toBeVisible();
      await expect(block.locator("h3")).toHaveText(t("shift.accept.title", lang));
      await expect(page.getByTestId("shift-acceptance-previous")).toHaveText(fmt(t("shift.acceptCount.previous", lang), "Anna", "17.11 10:00–12:00"));
      await expect(page.getByTestId("shift-acceptance-gap")).toHaveText(fmt(t("shift.acceptCount.gap", lang), "17.11 12:00", "18.11 12:30"));

      const cola = page.getByTestId("shift-acceptance-row").filter({ hasText: "Cola" });
      await expect(cola).toHaveClass(/is-shortage/);
      await expect(cola.locator('td[data-col="expected"]')).toHaveText("9");
      await expect(cola.locator('td[data-col="counted"]')).toHaveText("7");
      await expect(cola.locator('td[data-col="diff"]')).toHaveText(`${MINUS}2`);
      await expect(cola.locator('td[data-col="sold"]')).toHaveText("1");
      await expect(cola.getByTestId("shift-acceptance-last-sale")).toHaveText(fmt(t("shift.acceptCount.lastSale", lang), "17.11 11:40"));
      const chips = page.getByTestId("shift-acceptance-row").filter({ hasText: "Chips" });
      await expect(chips.locator('td[data-col="corrected"]')).toHaveText(`${MINUS}1`);
      await expect(chips.getByTestId("shift-acceptance-outcome")).toHaveText(t("shift.acceptCount.outcome.surplus", lang));
      const water = page.getByTestId("shift-acceptance-row").filter({ hasText: "Water" });
      await expect(water.locator('td[data-col="accepted"]')).toHaveText(t("shift.acceptCount.noPreviousCount", lang));
      await expect(water.getByTestId("shift-acceptance-outcome")).toHaveText(t("shift.acceptCount.outcome.baseline", lang));
      await expect(page.getByTestId("shift-acceptance-total-shortage")).toContainText(t("shift.acceptCount.totalShortage", lang).split("{0}")[0].trim());
      await expect(page.getByTestId("shift-acceptance-total-surplus")).toBeVisible();

      await block.scrollIntoViewIfNeeded();
      await noRawKeys(page, "[data-testid=shift-acceptance]");
      await fitsWidth(page, "[data-testid=shift-acceptance]");
      await block.screenshot({ path: path.join(SHOTS, `report-block-${lang}-${width}.png`) });
    });

    test(`owner: the shortage notification opens the shift (${lang}, ${width})`, async ({ page }) => {
      const notice = {
        id: "n-1", type: "App\\Notifications\\ShiftStockShortage", read_at: null, created_at: "2026-11-18T12:31:00+04:00",
        data: {
          type: "shift.stock_shortage", branch_id: 1, branch_address: "Abovyan 1", company_name: "Arena", shift_id: 42, previous_shift_id: 41,
          total_value: "1000.00", currency: "AMD", items: [{ name: "Cola", diff: -2, value: "1000.00" }], items_total: 1, blamed_user_name: "Anna",
          window_from: "2026-11-17T10:00:00+04:00", window_to: "2026-11-17T12:00:00+04:00", gap: FULL_COUNT.gap,
        },
      };
      await signIn(page, lang, width, "company_owner", async () => {
        await page.route(at("/notifications"), (r: Route) => r.fulfill(json({ data: [notice], meta: { current_page: 1, last_page: 1, per_page: 50, total: 1, unread_count: 1 } })));
        await page.route(at("/notifications/unread-count"), (r: Route) => r.fulfill(json({ unread_count: 1 })));
      });
      let asked = 0;
      await page.route(at("/shifts/42/summary"), (r: Route) => {
        asked++;
        return r.fulfill(json({ shift: { ...SUMMARY.shift, id: 42 }, report: { ...SUMMARY.report, acceptance_count: FULL_COUNT } }));
      });
      await page.route(at("/shifts"), (r: Route) => r.fulfill(json({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } })));
      await page.goto("/#/notifications");
      const title = page.getByText(`⚠ ${t("notifications.stockShortageTitle", lang).replace("{amount}", "")}`, { exact: false });
      await expect(title).toBeVisible();
      await expect(page.getByTestId("notification-body")).toContainText("Abovyan 1");
      await expect(page.getByTestId("notification-body")).toContainText("17.11 10:00–12:00");
      await noRawKeys(page, "main");
      await fitsWidth(page, "main");
      await shot(page, `notification-${lang}-${width}`);

      await title.click();
      await expect(page.getByTestId("shift-report-modal")).toBeVisible();
      await expect(page.getByTestId("shift-acceptance")).toBeVisible();
      expect(asked).toBe(1);
      expect(page.url()).toContain("/shifts?shift_id=42");
      await fitsWidth(page, "[data-testid=shift-acceptance]");
      await shot(page, `notification-opens-report-${lang}-${width}`);
    });
  }
}

test("a branch that counts nothing opens at once with stock_counts: [] (ru, 1280)", async ({ page }) => {
  await signIn(page, "ru" as Lang, 1280, "manager");
  let body: Record<string, unknown> | null = null;
  await shiftRoutes(page, () => (body ? { shift: SUMMARY.shift, report: SUMMARY.report } : { shift: null, report: null }));
  await page.route(at("/shifts/open"), (r: Route) => {
    body = r.request().postDataJSON() as Record<string, unknown>;
    return r.fulfill(json({ shift: SUMMARY.shift }, 201));
  });
  await page.goto("/#/branches/1/shift");
  await page.getByTestId("shift-open").click();
  await expect(page.getByTestId("shift-report")).toBeVisible();
  await expect(page.getByTestId("shift-accept")).toHaveCount(0);
  expect(body).toEqual({ branch_id: 1, opening_cash: "0.00", client_request_id: expect.any(String), stock_counts: [] });
});
