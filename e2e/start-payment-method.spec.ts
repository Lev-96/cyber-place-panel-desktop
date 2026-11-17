import { expect, test, type Page } from "@playwright/test";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, pc, runningSession, seedBoard, shot, signIn, type Lang } from "./helpers/moneySession";

/**
 * Paid ahead by card, cash, split or «Другое» (2026-11-17, owner: the Stop
 * methods at Start too). Shapes as in SessionPrepaidMethodTest: two hours at
 * 1000/h paid ahead (2000); by card, left at 1.5 h → 500 back TO THE CARD,
 * never a cash change. Cash sends no method — the start every panel sent.
 */

const prepaidSeat = (over: Record<string, unknown> = {}) => runningSession({
  mode: "fixed", is_unlimited: false, hourly_rate: 1000, committed_amount: 2000, prepaid_amount: 2000,
  ends_at: new Date(Date.now() + 90 * 60_000).toISOString(), ...over,
});
const cardPreview = {
  mode: "fixed", is_free: false, is_unlimited: false, elapsed_minutes: 90, time_cost: 1500, hourly_rate: 1000, package_name: null,
  items: [], items_total: 0, unpaid_items_total: 0, joysticks: [], joysticks_total: 0, subtotal: 1500, gross_total: 1500, total: 1500,
  priced_at: new Date().toISOString(), prepaid: { amount: 2000, change: 500, due: 0, by_method: { card: 2000 }, refund: { card: 500 } },
};

const START: Record<Lang, string> = { en: "Start", ru: "Старт", am: "Սկսել" };
const CARD_BACK: Record<Lang, string> = { en: "Back to the card", ru: "Вернуть на карту", am: "Վերադարձնել քարտին" };

const openStart = async (page: Page, lang: Lang, width: number) => {
  let body: Record<string, unknown> | null = null;
  await signIn(page, lang, width);
  await seedBoard(page, { pcs: [pc(3, null)], sessions: () => [] });
  await page.route(at("/time-packages"), (r) => r.fulfill(json({ data: [] })));
  await page.route(at("/sessions/start-quote"), (r) => {
    const minutes = Number(new URL(r.request().url()).searchParams.get("minutes"));
    return r.fulfill(json({ minutes, hourly_rate: 1000, amount: (1000 * minutes) / 60, standard_amount: (1000 * minutes) / 60 }));
  });
  await page.route(at("/sessions"), (r) => {
    if (r.request().method() !== "POST") return r.fallback();
    body = r.request().postDataJSON();
    return r.fulfill(json({ session: prepaidSeat() }, 201));
  });
  await openBoard(page);
  await page.locator('.place-cell [data-action="start"]').first().click();
  await page.getByTestId("planned-duration-input-hours").fill("2");
  await page.getByTestId("prepaid-switch").click();
  return { body: () => body };
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`Start paid ahead by card: the Stop control, «card» sent (${lang}, ${width})`, async ({ page }) => {
      const start = await openStart(page, lang, width);
      const editor = page.getByTestId("payment-editor");
      await expect(editor).toBeVisible();
      await expect(page.getByTestId("pay-cash")).toHaveAttribute("aria-checked", "true");
      await page.getByTestId("pay-card").click();
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[data-testid=payment-editor]");
      await shot(page, `start-pay-card-${lang}-${width}`);
      await page.locator(".start-dialog").getByRole("button", { name: START[lang], exact: true }).click();
      await expect.poll(start.body).toMatchObject({ duration_minutes: 120, prepaid: true, payment_method: "card" });
    });

    test(`Start split 1 200 cash + 800 card: Start waits until it adds up (${lang}, ${width})`, async ({ page }) => {
      const start = await openStart(page, lang, width);
      await page.getByTestId("pay-split").click();
      const parts = page.locator(".pay-editor__part input");
      await parts.nth(0).fill("1200");
      const startButton = page.locator(".start-dialog").getByRole("button", { name: START[lang], exact: true });
      await expect(startButton).toBeDisabled();
      await page.getByTestId("pay-rest-card").click();
      await expect(parts.nth(1)).toHaveValue(/800/);
      await expect(startButton).toBeEnabled();
      await shot(page, `start-pay-split-${lang}-${width}`);
      await startButton.click();
      await expect.poll(start.body).toMatchObject({ prepaid: true, payments: [{ method: "cash", amount: 1200 }, { method: "card", amount: 800 }] });
    });

    test(`Stop after a card prepayment: 500 back to the card, no cash change (${lang}, ${width})`, async ({ page }) => {
      await signIn(page, lang, width);
      await seedBoard(page, { session: () => prepaidSeat() });
      await page.route(at("/sessions/5/preview"), (r) => r.fulfill(json({ preview: cardPreview })));
      await page.route(at("/sessions/5/stop"), (r) => r.fulfill(json({
        session: runningSession({ status: "stopped", prepaid_amount: 2000, cash_received: null, cash_change: null, total_paid: 1500 }),
        breakdown: cardPreview,
        cash: null,
      })));
      await openBoard(page);
      await page.locator('[data-action="stop"]').first().click();
      const back = page.getByTestId("receipt-prepaid-card-refund");
      await expect(back).toContainText(CARD_BACK[lang]);
      await expect(back).toContainText("500");
      await expect(page.getByTestId("receipt-prepaid-change")).toHaveCount(0);
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[data-testid=receipt-prepaid]");
      await shot(page, `stop-card-refund-${lang}-${width}`);
      await page.getByTestId("stop-confirm").click();
      // After the Stop: still the card refund, still no cash change.
      await expect(page.getByTestId("receipt-prepaid-card-refund")).toContainText("500");
      await expect(page.getByTestId("receipt-prepaid-change")).toHaveCount(0);
    });
  }
}

test("Start paid ahead in cash: the request carries no method — as before (ru, 1280)", async ({ page }) => {
  const start = await openStart(page, "ru", 1280);
  await page.locator(".start-dialog").getByRole("button", { name: "Старт", exact: true }).click();
  await expect.poll(start.body).toMatchObject({ duration_minutes: 120, prepaid: true });
  for (const k of ["payment_method", "payments", "payment_method_other", "payment_note"]) expect(start.body()).not.toHaveProperty(k);
});

test("«+ Время» paid now by card sends the method (en, 1280)", async ({ page }) => {
  let body: Record<string, unknown> | null = null;
  await signIn(page, "en", 1280);
  await seedBoard(page, { session: () => prepaidSeat() });
  await page.route(at("/sessions/5/time-quote"), (r) => r.fulfill(json({ minutes: 30, charge: 500, hourly_rate: 1000, price_editable: false, is_free: false, standard_charge: 500 })));
  await page.route(at("/sessions/5/time"), (r) => {
    body = r.request().postDataJSON();
    return r.fulfill(json({ session: prepaidSeat({ prepaid_amount: 2500 }) }));
  });
  await openBoard(page);
  await page.locator('[data-action="add-time"]').first().click();
  await page.getByTestId("grant-duration-minutes").fill("30");
  await page.getByTestId("time-prepaid-switch").click();
  await page.getByTestId("pay-card").click();
  await shot(page, "time-paid-now-card-en-1280");
  await page.getByRole("button", { name: /Add 30 min/ }).click();
  await expect.poll(() => body).toEqual({ minutes: 30, prepaid: true, payment_method: "card" });
});
