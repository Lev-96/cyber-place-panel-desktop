import { expect, test } from "@playwright/test";
import { LANGS, WIDTHS, fitsWidth, noRawKeys, signIn } from "./helpers/moneySession";

/**
 * «История продаж» in figures (2026-11-18, owner), in a real browser, en/ru/am
 * at desktop and phone width: the day and the working hours, the server's
 * totals, each way of paying with how many times, and a card's records.
 */
const GRAND = { en: "Total of all sales", ru: "Итог общей продажи", am: "Ընդհանուր վաճառքի արդյունքը" };
const HOURS = { en: "Counted from 13:00 to 07:00", ru: "Расчёт с 13:00 до 07:00", am: "Հաշվարկը՝ 13:00-ից 07:00" };

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`figures, hours and a card's records (${lang}, ${width})`, async ({ page }) => {
      await signIn(page, lang, width);
      await page.evaluate(() => { window.location.hash = "#/branches/1/sessions/history"; });
      await expect(page.getByTestId("sales-grand")).toContainText(GRAND[lang]);
      await expect(page.getByTestId("sales-hours")).toContainText(HOURS[lang]);
      await expect(page.getByTestId("history-from").locator("button")).toHaveText(/^\d{2}\.\d{2}\.\d{4}$/);
      await expect(page.getByTestId("sales-method-other-Hovo Card")).toContainText("Hovo Card");
      await noRawKeys(page);
      expect(await page.locator("body").innerText()).not.toMatch(/\bsales\.[a-z][A-Za-z_.]+/);
      await fitsWidth(page, "[data-testid=sales-summary]");
      // The range shown is lit; refresh is the yellow icon (2026-11-18).
      await expect(page.getByTestId("history-range-today")).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("history-refresh")).toBeVisible();
      if (process.env.CP_SHOTS_DIR) await page.locator(".gradient-card").first().screenshot({ path: `${process.env.CP_SHOTS_DIR}/history-filters-${lang}-${width}.png` });
      if (process.env.CP_SHOTS_DIR) await page.getByTestId("sales-summary").screenshot({ path: `${process.env.CP_SHOTS_DIR}/sales-cards-${lang}-${width}.png` });
      await page.getByTestId("sales-method-other-Hovo Card").click();
      await expect(page.getByTestId("sales-line-place-5")).toContainText("Hovo Card");
      await expect(page.getByTestId("sales-line-place-6")).toHaveCount(0);
      await page.waitForTimeout(400);
      if (process.env.CP_SHOTS_DIR) await page.screenshot({ path: `${process.env.CP_SHOTS_DIR}/sales-lines-${lang}-${width}.png` });
    });
  }
}
