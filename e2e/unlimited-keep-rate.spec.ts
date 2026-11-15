import { expect, test, type Page } from "@playwright/test";
import { LANGS, WIDTHS, at, confirmInApp, fitsWidth, json, noRawKeys, openBoard, runningSession, seedBoard, shot, signIn, type Lang } from "./helpers/moneySession";

/**
 * D (2026-11-15): «Безлимит» asks no price. The seat carries on at the rate it
 * bills now (`keep_rate: true`), and the toast says the SERVER's `hourly_now`
 * (SessionUnlimitedKeepRateTest: seat 1000 + pads 500 = 1500/h). «⏱ Время» on
 * an unlimited seat toasts "until HH:MM, at 1500/h" from `/limit`'s answer.
 */

const hourlyNow = { seat: 1000, pads: 500, extras: 0, total: 1500 };
const KEPT: Record<Lang, RegExp> = {
  en: /Unlimited\. Price kept: 1,?500 .*\/h/,
  ru: /Безлимит\. Цена прежняя: 1[\s,.]?500 .*\/ч/,
  am: /Անսահմանափակ։ Գինը նույնն է՝ 1[\s,.]?500 .*\/ժ/,
};
const UNTIL: Record<Lang, RegExp> = {
  en: /Until \d\d:\d\d, at 1,?500/,
  ru: /До \d\d:\d\d, по 1[\s,.]?500/,
  am: /Մինչև \d\d:\d\d, 1[\s,.]?500/,
};

const timed = () => runningSession({ mode: "fixed", is_unlimited: false, ends_at: new Date(Date.now() + 40 * 60_000).toISOString(),
  joysticks: [{ slot: 2, price: 500, is_hourly: true, is_charged: true, started_at: new Date().toISOString(), stopped_at: null }], joystick_count: 2 });

/** Routes are registered AFTER sign-in: the catch-all mock registered there would otherwise win. */
const open = async (page: Page, lang: Lang, width: number, s: () => Record<string, unknown>, routes: () => Promise<void>) => {
  await signIn(page, lang, width);
  await seedBoard(page, { session: s });
  await routes();
  await openBoard(page);
  await page.locator('[data-action="add-time"]').first().click();
  await expect(page.getByRole("dialog").first()).toBeVisible();
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`unlimited: no price box, keep_rate sent, the server's figure toasted (${lang}, ${width})`, async ({ page }) => {
      let body: unknown = null;
      await open(page, lang, width, timed, async () => {
        await page.route(at("/sessions/5/unlimited"), (r) => {
          body = r.request().postDataJSON();
          return r.fulfill(json({ session: runningSession(), hourly_now: hourlyNow }));
        });
      });
      const section = page.getByTestId("unlimited-section");
      await section.scrollIntoViewIfNeeded();
      await section.locator(".cp-checkbox").first().click();
      await expect(page.getByTestId("unlimited-keep-rate")).toBeVisible();
      await expect(section.locator("input[inputmode=decimal]")).toHaveCount(0);
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[data-testid=unlimited-section]");
      await shot(page, `unlimited-keep-rate-${lang}-${width}`);
      await section.getByRole("button").last().click();
      // The in-app confirm, then the request.
      await confirmInApp(page, lang);
      await expect.poll(() => body).toEqual({ keep_rate: true });
      await expect(page.getByText(KEPT[lang]).first()).toBeVisible();
      await shot(page, `unlimited-keep-rate-toast-${lang}-${width}`);
    });

    test(`limit: the server's end and per-hour figure in the toast (${lang}, ${width})`, async ({ page }) => {
      await open(page, lang, width, () => runningSession(), async () => {
        await page.route(at("/sessions/5/limit"), (r) => r.fulfill(json({
          session: runningSession({ is_unlimited: false, ends_at: new Date(Date.now() + 60 * 60_000).toISOString() }), hourly_now: hourlyNow,
        })));
      });
      await page.getByTestId("limit-duration-hours").fill("1");
      await page.getByTestId("limit-confirm").click();
      await expect(page.getByText(UNTIL[lang]).first()).toBeVisible();
    });
  }
}
