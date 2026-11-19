import { expect, test, type Page } from "@playwright/test";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, pc, runningSession, seedBoard, shot, signIn, type Lang } from "./helpers/moneySession";

/**
 * 2026-11-17 (owner): two running seats swap places, each with its own bill;
 * a seat with no limit may be paid ahead a named sum (never required). Shapes
 * as in SessionSwapTest and SessionPrepaidMethodTest.
 */

const SWAP: Record<Lang, string> = { en: "Swap places", ru: "Поменять местами", am: "Փոխանակել տեղերը" };
const START: Record<Lang, string> = { en: "Start", ru: "Старт", am: "Սկսել" };

const relocationOptions = {
  current: { place_id: 3, number: 3, name: null, platform: "ps5", type: "standard", hourly_rate: 1000, ends_at: null, paused: false },
  places: [],
  swap: [{ session_id: 9, place_id: 4, number: 4, name: null, type: "vip", player: "Давид", hourly_rate: 2000 }],
};

const openRelocate = async (page: Page, lang: Lang, width: number) => {
  const calls: unknown[] = [];
  await signIn(page, lang, width);
  await seedBoard(page, { session: () => runningSession() });
  await page.route(at("/sessions/5/relocation-options"), (r) => r.fulfill(json(relocationOptions)));
  await page.route(at("/sessions/5/swap"), (r) => {
    calls.push(r.request().postDataJSON());
    return r.fulfill(json({ session: runningSession({ pc_id: 4 }), other: runningSession({ id: 9, pc_id: 3 }) }));
  });
  await openBoard(page);
  await page.locator('[data-action="relocate"]').first().click();
  return calls;
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`swap with a running seat: offered, summarised, sent (${lang}, ${width})`, async ({ page }) => {
      const calls = await openRelocate(page, lang, width);
      await expect(page.getByTestId("relocate-swap")).toContainText("Давид");
      await page.getByTestId("swap-9").click();
      await expect(page.getByTestId("swap-summary")).toBeVisible();
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[data-testid=relocate-swap]");
      await shot(page, `swap-${lang}-${width}`);
      await expect(page.getByTestId("swap-confirm")).toHaveText(SWAP[lang]);
      await page.getByTestId("swap-confirm").click();
      await expect.poll(() => calls).toEqual([{ with_session_id: 9 }]);
    });

    // 2026-11-20 (owner): the sum paid now BUYS time — sent as «На сумму» on the server's answer.
    test(`no limit, paid ahead 5 000 by card: the sum buys 5 h (${lang}, ${width})`, async ({ page }) => {
      let body: Record<string, unknown> | null = null;
      await signIn(page, lang, width);
      await seedBoard(page, { pcs: [pc(3, null)], sessions: () => [] });
      await page.route(at("/time-packages"), (r) => r.fulfill(json({ data: [] })));
      await page.route(at("/sessions/start-quote"), (r) => r.fulfill(json({
        amount: 5000, hourly_rate: 1000, outside_food_fee: 0, time_amount: 5000, seconds: 18000, minutes: 300,
        ends_at: new Date(Date.now() + 18000_000).toISOString(), standard_amount: null,
      })));
      await page.route(at("/sessions"), (r) => {
        if (r.request().method() !== "POST") return r.fallback();
        body = r.request().postDataJSON();
        return r.fulfill(json({ session: runningSession({ prepaid_amount: 5000 }) }, 201));
      });
      await openBoard(page);
      await page.locator('.place-cell [data-action="start"]').first().click();
      await page.getByTestId("prepaid-switch").click();
      await page.getByTestId("start-prepaid-sum").locator("input").fill("5000");
      await expect(page.getByTestId("start-prepaid-buys")).toContainText("5");
      await page.getByTestId("pay-card").click();
      await noRawKeys(page, "[role=dialog]");
      await shot(page, `unlimited-prepay-${lang}-${width}`);
      await page.locator(".start-dialog").getByRole("button", { name: START[lang], exact: true }).click();
      await expect.poll(() => body).toMatchObject({ mode: "open", paid_amount: 5000, paid_seconds: 18000, payment_method: "card" });
      expect(body).not.toHaveProperty("prepaid_sum");
    });
  }
}
