import { expect, test } from "@playwright/test";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, signIn } from "./helpers/moneySession";

/**
 * «Изменить способ оплаты» (2026-11-19, owner): in «История продаж» a place's
 * record offers the change; the dialog is the Stop payment control on the same
 * total; Save sends `PUT /sessions/{id}/payment` once and the figures are read
 * again. A sale without a place has no button. en/ru/am × desktop/phone.
 */
const SHOTS = "/home/developer/cyber-place-local/reports/change-payment-2026-11-19";

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`a place's record: change card → cash, sent once, the figures read again (${lang}, ${width})`, async ({ page }) => {
      const sent: unknown[] = [];
      let summaryReads = 0;
      await signIn(page, lang, width, "manager");
      await page.route(at("/sessions/6/payment"), (r) => {
        if (r.request().method() !== "PUT") return r.fallback();
        sent.push(r.request().postDataJSON());
        return r.fulfill(json({ session: { id: 6, status: "stopped", payment_method: "cash" } }));
      });
      page.on("request", (rq) => { if (/\/branches\/\d+\/sales-summary/.test(rq.url())) summaryReads += 1; });
      await page.evaluate(() => { window.location.hash = "#/branches/1/sessions/history"; });
      await page.getByTestId("sales-method-card").click();
      await expect(page.getByTestId("sales-line-place-6")).toBeVisible();
      await page.getByTestId("sales-line-change-6").click();
      const dialog = page.getByTestId("change-payment-dialog");
      await expect(dialog).toBeVisible();
      await expect(page.getByTestId("change-payment-what")).toContainText(/4[\s,.  ]?000/);
      await page.getByTestId("pay-cash").click();
      await noRawKeys(page, "[data-testid=change-payment-dialog]");
      await fitsWidth(page, "[data-testid=change-payment-dialog]");
      await page.waitForTimeout(300);
      await dialog.screenshot({ path: `${SHOTS}/dialog-${lang}-${width}.png` });
      const before = summaryReads;
      await page.getByTestId("change-payment-save").click();
      await expect.poll(() => sent).toEqual([{ payment_method: "cash" }]);
      await expect(dialog).toHaveCount(0);
      await expect.poll(() => summaryReads).toBeGreaterThan(before);
    });
  }
}

test("a sale without a place, and a split place, offer it as the server allows", async ({ page }) => {
  await signIn(page, "ru", 1280, "manager");
  await page.evaluate(() => { window.location.hash = "#/branches/1/sessions/history"; });
  await page.getByTestId("sales-method-cash").click();
  await expect(page.getByTestId("sales-line-till-9")).toBeVisible();
  await expect(page.getByTestId("sales-line-change-9")).toHaveCount(0);
  await expect(page.getByTestId("sales-line-change-5")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/lines-ru-1280.png` });
});

test("the server's refusal is said in the dialog; nothing else changes", async ({ page }) => {
  await signIn(page, "ru", 1280, "manager");
  await page.route(at("/sessions/6/payment"), (r) => r.fulfill({ status: 422, contentType: "application/json",
    body: JSON.stringify({ message: "Кассовая смена, в которую попала эта сессия, закрыта. Её отчёт уже не меняется." }) }));
  await page.evaluate(() => { window.location.hash = "#/branches/1/sessions/history"; });
  await page.getByTestId("sales-method-card").click();
  await page.getByTestId("sales-line-change-6").click();
  await page.getByTestId("change-payment-save").click();
  await expect(page.getByTestId("change-payment-error")).toContainText("смена");
  await expect(page.getByTestId("change-payment-dialog")).toBeVisible();
});
