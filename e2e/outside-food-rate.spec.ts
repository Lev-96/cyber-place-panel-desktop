import { expect, test, type Page } from "@playwright/test";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, pc, runningSession, seedBoard, shot, signIn, type Lang } from "./helpers/moneySession";
import { dismissUnpaidNotice } from "./helpers/unpaidNotice";

/**
 * «Свои продукты» as the seat's rate (2026-11-17, owner): a VIP seat at
 * 2 500/h with own food at 4 000 is a 4 000/h seat — at the start, and
 * switched (or re-priced) during the game in «+ Время». Shapes as in
 * SessionOutsideFoodRateTest.
 */

const OPTIONS = { free_until: null, max_minutes: null, unlimited_allowed: true, next_booking: null, claimable_bookings: [], outside_food_fee: 4000, outside_food_mode: "tariff" };
const START: Record<Lang, string> = { en: "Start", ru: "Старт", am: "Սկսել" };
const SECTION: Record<Lang, string> = { en: "Own food", ru: "Свои продукты", am: "Սեփական սնունդ" };

const openStart = async (page: Page, lang: Lang, width: number) => {
  let body: Record<string, unknown> | null = null;
  const quotes: string[] = [];
  await signIn(page, lang, width);
  await seedBoard(page, { pcs: [pc(3, null)], sessions: () => [] });
  await page.route(at("/time-packages"), (r) => r.fulfill(json({ data: [] })));
  await page.route(at("/sessions/start-options"), (r) => r.fulfill(json(OPTIONS)));
  await page.route(at("/sessions/start-quote"), (r) => {
    const url = new URL(r.request().url());
    quotes.push(url.search);
    const minutes = Number(url.searchParams.get("minutes"));
    const rate = url.searchParams.get("outside_food") === "1" ? 4000 : 2500;
    return r.fulfill(json({ minutes, hourly_rate: rate, amount: (rate * minutes) / 60, standard_amount: (2500 * minutes) / 60 }));
  });
  await page.route(at("/sessions"), (r) => {
    if (r.request().method() !== "POST") return r.fallback();
    body = r.request().postDataJSON();
    return r.fulfill(json({ session: runningSession({ hourly_rate: 4000, outside_food_rate: 4000, rate_before_outside_food: 2500 }) }, 201));
  });
  await openBoard(page);
  await page.locator('.place-cell [data-action="start"]').first().click();
  await dismissUnpaidNotice(page);
  return { body: () => body, quotes };
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`Start with own food as the rate: 4 000/h, the plan at it, no hand price (${lang}, ${width})`, async ({ page }) => {
      const start = await openStart(page, lang, width);
      await page.getByTestId("outside-food-switch").click();
      await expect(page.getByTestId("outside-food-hint")).toContainText(/4[\s.,  ]?000/);
      await page.getByTestId("planned-duration-input-hours").fill("2");
      await expect.poll(() => start.quotes.some((q) => q.includes("outside_food=1"))).toBe(true);
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[data-testid=start-switches]");
      await shot(page, `start-food-rate-${lang}-${width}`);
      await page.locator(".start-dialog").getByRole("button", { name: START[lang], exact: true }).click();
      await expect.poll(start.body).toMatchObject({ duration_minutes: 120, outside_food: true, outside_food_fee: 4000 });
      expect(start.body()).not.toHaveProperty("hourly_rate");
    });

    test(`«+ Время»: own food switched on during the game, then off (${lang}, ${width})`, async ({ page }) => {
      const calls: unknown[] = [];
      let current = runningSession({ hourly_rate: 2500, tariff_hourly_rate: 2500 });
      await signIn(page, lang, width);
      await seedBoard(page, { session: () => current });
      await page.route(at("/sessions/start-options"), (r) => r.fulfill(json(OPTIONS)));
      await page.route(at("/sessions/5/outside-food"), (r) => {
        const b = r.request().postDataJSON() as { on: boolean };
        calls.push(b);
        current = b.on
          ? runningSession({ hourly_rate: 4000, tariff_hourly_rate: 4000, outside_food_rate: 4000, rate_before_outside_food: 2500 })
          : runningSession({ hourly_rate: 2500, tariff_hourly_rate: 2500 });
        return r.fulfill(json({ session: current }));
      });
      await openBoard(page);
      await page.locator('[data-action="add-time"]').first().click();
      const section = page.getByTestId("outside-food-rate-section");
      await expect(section).toContainText(SECTION[lang]);
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[data-testid=outside-food-rate-section]");
      await shot(page, `time-food-rate-${lang}-${width}`);
      await page.getByTestId("outside-food-rate-apply").click();
      await expect.poll(() => calls).toEqual([{ on: true, rate: 4000 }]);
      await expect(page.getByTestId("outside-food-rate-off")).toBeVisible();
      await page.getByTestId("outside-food-rate-off").click();
      await expect.poll(() => calls).toEqual([{ on: true, rate: 4000 }, { on: false }]);
    });
  }
}
