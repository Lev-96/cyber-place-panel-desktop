import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { t } from "../src/i18n/translations";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, runningSession, seedBoard, signIn, type Lang } from "./helpers/moneySession";

/**
 * Split payment is never required (2026-11-15, owner). Shapes as in the
 * backend's SplitPaymentTest: a seat of 1 000, a till sale of 1 000.
 *
 *  - Stop by card is ONE click on «Карта» then confirm; nothing else asked.
 *  - «Разделить» at the till: card 600 + «Остаток» cash 400, no note — sold in
 *    one press, sent as `payments` with no `payment_note`.
 *  - The note's label says it is optional; nothing on the screen is starred.
 *  - A sale «Другое» with no words reads «Другое» in the till's list.
 */

const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/history-filter-split-stock-2026-11-15/panel");
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

const NOTE_LABEL: Record<Lang, string> = {
  en: "How it was paid (optional)",
  ru: "Как оплатили (необязательно)",
  am: "Ինչպես վճարեցին (ըստ ցանկության)",
};

const preview = {
  mode: "open", is_free: false, is_unlimited: true, elapsed_minutes: 60, time_cost: 1000, hourly_rate: 1000, package_name: null,
  items: [], items_total: 0, unpaid_items_total: 0, joysticks: [], joysticks_total: 0, subtotal: 1000, gross_total: 1000, total: 1000,
  priced_at: new Date().toISOString(), prepaid: null,
};

const cola = { id: 3, branch_id: 1, name: "Cola", price: "1000.00", is_active: true, kind: "regular" };

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`Stop by card in one click, nothing else asked (${lang}, ${width})`, async ({ page }) => {
      let body: Record<string, unknown> | null = null;
      await signIn(page, lang, width);
      await seedBoard(page, { session: () => runningSession() });
      await page.route(at("/sessions/5/preview"), (r) => r.fulfill(json({ preview })));
      await page.route(at("/sessions/5/stop"), (r) => {
        body = r.request().postDataJSON();
        return r.fulfill(json({
          session: runningSession({ status: "stopped", total_paid: 1000, payment_method: "card", payments: [{ method: "card", amount: "1000.00", note: null }] }),
          breakdown: preview,
          cash: null,
        }));
      });
      await openBoard(page);
      await page.locator('[data-action="stop"]').first().click();
      await expect(page.getByTestId("payment-editor")).toBeVisible();

      // The split's note says it is optional, and nothing is starred.
      await page.getByTestId("pay-split").click();
      await expect(page.getByText(NOTE_LABEL[lang], { exact: true })).toBeVisible();
      expect(await page.getByTestId("payment-editor").innerText()).not.toContain("*");
      await fitsWidth(page, "[data-testid=payment-editor]");
      await shot(page, `stop-split-optional-${lang}-${width}`);

      // Card, confirm: that is all.
      await page.getByTestId("pay-card").click();
      await page.getByTestId("stop-confirm").click();
      await expect.poll(() => body).toMatchObject({ payment_method: "card", expected_total: 1000 });
      expect(body).not.toHaveProperty("payments");
      expect(body).not.toHaveProperty("payment_note");
      expect(body).not.toHaveProperty("payment_method_other");
      await noRawKeys(page, "[role=dialog]");
    });

    test(`till: split card 600 + cash 400 with no note sells in one press (${lang}, ${width})`, async ({ page }) => {
      let body: Record<string, unknown> | null = null;
      const sold: Record<string, unknown>[] = [{
        id: 1, branch_id: 1, subtotal: 1000, total: 1000, payment_method: "other", payment_method_other: null, status: "paid",
        created_at: new Date().toISOString(), cash_received: null, change: null, cashier: null,
        items: [{ id: 1, product_name: "Cola", quantity: 1, unit_price: 1000, line_total: 1000 }],
        payments: [{ method: "other", amount: "1000.00", note: null }],
      }];
      await signIn(page, lang, width);
      await page.route((u) => u.hostname !== "localhost" && u.pathname === "/products", (r) => r.fulfill(json({ data: [cola] })));
      await page.route(at("/orders"), (r) => {
        if (r.request().method() !== "POST") return r.fulfill(json({ data: sold }));
        body = r.request().postDataJSON();
        const order = {
          ...sold[0], id: 2, payment_method: "split",
          payments: [{ method: "cash", amount: "400.00", note: null }, { method: "card", amount: "600.00", note: null }],
        };
        sold.unshift(order);
        return r.fulfill(json({ order }, 201));
      });
      await page.goto("/#/branches/1/pos");

      // A sale «Другое» with no words already on today's list: it reads «Другое».
      await expect(page.locator(".list-item").first()).toContainText(t("pay.otherShort", lang));

      await page.getByRole("button", { name: t("till.sell", lang), exact: true }).click();
      // The dialog opens on typing; the list is the other mode (its label text is the click target).
      await page.getByText(t("session.addModePicker", lang), { exact: true }).click();
      await page.getByLabel(`${t("action.add", lang)}: Cola`).click();
      await page.getByTestId("pay-split").click();
      await page.getByLabel(t("session.payCard", lang), { exact: true }).and(page.locator("input")).fill("600");
      await page.getByTestId("pay-rest-cash").click();
      await expect(page.getByTestId("pay-remaining")).toHaveText(t("pay.allPaid", lang));
      await expect(page.getByText(NOTE_LABEL[lang], { exact: true })).toBeVisible();
      await expect(page.getByTestId("pay-note")).toHaveValue("");
      await fitsWidth(page, "[data-testid=payment-editor]");
      await shot(page, `till-split-no-note-${lang}-${width}`);

      await page.getByRole("button", { name: t("till.sellConfirm", lang), exact: true }).click();
      await expect.poll(() => body).toMatchObject({
        branch_id: 1,
        payments: [{ method: "cash", amount: 400 }, { method: "card", amount: 600 }],
      });
      expect(body).not.toHaveProperty("payment_note");
      expect(body).not.toHaveProperty("payment_method");
      expect(body).not.toHaveProperty("cash_received");

      // The list reads the new sale as a split, each part with its figure.
      await expect(page.locator(".list-item").first()).toContainText(t("pay.splitSummary", lang));
      await noRawKeys(page);
    });
  }
}
