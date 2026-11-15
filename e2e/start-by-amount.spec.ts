import { expect, test, type Page } from "@playwright/test";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, pc, runningSession, seedBoard, shot, signIn, type Lang } from "./helpers/moneySession";

/**
 * A (2026-11-15): «На сумму». Shapes as in SessionStartByAmountTest: 5000 at
 * 1000/h → seconds 18000, minutes 300; the server's 422 sentences shown as
 * they come; Start sends `paid_amount` + `paid_seconds` and nothing else about
 * the price.
 */
const quote5000 = { amount: 5000, hourly_rate: 1000, outside_food_fee: 0, time_amount: 5000, seconds: 18000, minutes: 300,
  ends_at: new Date(Date.now() + 5 * 3600_000).toISOString(), standard_amount: 5000 };
const STEP: Record<Lang, string> = {
  en: "The amount must be a multiple of 100 (the branch's rounding step).",
  ru: "Сумма должна быть кратна 100 (шаг округления филиала).",
  am: "Գումարը պետք է լինի 100-ի բազմապատիկ (մասնաճյուղի կլորացման քայլ)։",
};
const START: Record<Lang, string> = { en: "Start", ru: "Старт", am: "Սկսել" };
const RESULT: Record<Lang, RegExp> = { en: /5,?000 .*→\s*5 h/, ru: /5[\s.,]?000 .*→\s*5 ч/, am: /5[\s.,]?000 .*→\s*5 ժ/ };

const open = async (page: Page, lang: Lang, width: number) => {
  let body: Record<string, unknown> | null = null;
  await signIn(page, lang, width);
  await seedBoard(page, { pcs: [pc(3, null)], sessions: () => [] });
  await page.route(at("/time-packages"), (r) => r.fulfill(json({ data: [] })));
  await page.route(at("/sessions/start-quote"), (r) => {
    const amount = Number(new URL(r.request().url()).searchParams.get("amount"));
    return amount % 100 !== 0
      ? r.fulfill(json({ message: STEP[lang] }, 422))
      : r.fulfill(json({ ...quote5000, amount, time_amount: amount, seconds: amount * 3.6, minutes: Math.ceil(amount * 3.6 / 60) }));
  });
  await page.route(at("/sessions"), (r) => {
    if (r.request().method() !== "POST") return r.fallback();
    body = r.request().postDataJSON();
    return r.fulfill(json({ session: runningSession({ prepaid_amount: 5000 }) }, 201));
  });
  await openBoard(page);
  await page.locator('.place-cell [data-action="start"]').first().click();
  await expect(page.locator(".start-dialog")).toBeVisible();
  return () => body;
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`by amount: the server's answer, big; Start sends the sum and its seconds (${lang}, ${width})`, async ({ page }) => {
      const sent = await open(page, lang, width);
      await page.getByTestId("start-mode-amount").click();
      const box = page.getByTestId("start-amount").locator("input");
      await expect(box).toBeFocused();
      await page.keyboard.type("5050");
      await expect(page.getByTestId("start-amount-error")).toHaveText(STEP[lang]);
      await expect(page.locator(".start-dialog").getByRole("button", { name: START[lang], exact: true })).toBeDisabled();
      await box.fill("5000");
      const result = page.getByTestId("start-amount-result");
      await expect(result).toHaveText(RESULT[lang]);
      const size = await result.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(size).toBeGreaterThanOrEqual(24);
      await expect(page.getByTestId("start-amount-note")).toBeVisible();
      await expect(page.getByTestId("unpaid-switch")).toHaveCount(0);
      await noRawKeys(page, ".start-dialog");
      await fitsWidth(page, ".start-dialog");
      await shot(page, `start-by-amount-${lang}-${width}`);
      await page.locator(".start-dialog").getByRole("button", { name: START[lang], exact: true }).click();
      await expect.poll(sent).toEqual({ branch_id: 1, pc_id: 3, user_display_name: "PS5 3", paid_amount: 5000, paid_seconds: 18000 });
    });
  }
}
