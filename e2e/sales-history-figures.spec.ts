import { expect, test } from "@playwright/test";
import { LANGS, WIDTHS, fitsWidth, noRawKeys, signIn } from "./helpers/moneySession";

/**
 * «История продаж» in figures (2026-11-18, owner), in a real browser, en/ru/am
 * at desktop and phone width: the day and the working hours, the server's
 * totals, each way of paying with how many times, and a card's records.
 */
const GRAND = { en: "Total of all sales", ru: "Итог общей продажи", am: "Ընդհանուր վաճառքի արդյունքը" };
const HOURS = { en: "Counted from 13:00 18.11.2026 to 07:00 19.11.2026", ru: "Расчёт: с 13:00 18.11.2026 до 07:00 19.11.2026", am: "Հաշվարկը՝ 18.11.2026 13:00-ից մինչև 19.11.2026 07:00" };

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`figures, hours and a card's records (${lang}, ${width})`, async ({ page }) => {
      await signIn(page, lang, width);
      await page.evaluate(() => { window.location.hash = "#/branches/1/sessions/history"; });
      await expect(page.getByTestId("sales-grand")).toContainText(GRAND[lang]);
      await expect(page.getByTestId("sales-hours")).toContainText(HOURS[lang]);
      await expect(page.getByTestId("history-from").locator(".date-field__text")).toHaveText(/^\d{2}\.\d{2}\.\d{4}$/);
      // A tap anywhere on the date lands on the real date input (2026-11-18,
      // owner: on a phone the calendar did not open) — the phone opens its own.
      for (const id of ["history-from", "history-to"]) {
        const hit = await page.getByTestId(id).evaluate((root) => {
          const r = root.getBoundingClientRect();
          const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) as HTMLInputElement | null;
          return el ? `${el.tagName}:${el.type}` : "none";
        });
        expect(hit, id).toBe("INPUT:date");
      }
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
