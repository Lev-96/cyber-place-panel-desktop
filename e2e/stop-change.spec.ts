import { expect, test, type Page } from "@playwright/test";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, pc, runningSession, seedBoard, shot, signIn, type Lang } from "./helpers/moneySession";

/**
 * C (2026-11-15): paid ahead, change at Stop. Shapes as in
 * SessionPrepaidChangeTest: 2000 paid for two hours, 1500 played → 500 back;
 * 2500 played → 500 still due. The Start dialog's «Оплачено вперёд» sends
 * `prepaid: true`; the card says the prepayment; the receipt says the change
 * BIG and green (≥ 40 px, role=status) or the due in amber; after the Stop the
 * change is the server's `cash.change`.
 */

const prepaidSeat = () => runningSession({
  mode: "fixed", is_unlimited: false, hourly_rate: 1000, committed_amount: 2000, prepaid_amount: 2000,
  ends_at: new Date(Date.now() + 90 * 60_000).toISOString(),
});
const preview = (total: number, change: number, due: number) => ({
  mode: "fixed", is_free: false, is_unlimited: false, elapsed_minutes: 90, time_cost: total, hourly_rate: 1000, package_name: null,
  items: [], items_total: 0, unpaid_items_total: 0, joysticks: [], joysticks_total: 0, subtotal: total, gross_total: total, total,
  priced_at: new Date().toISOString(), prepaid: { amount: 2000, change, due },
});

const CHANGE: Record<Lang, string> = { en: "Change", ru: "Сдача", am: "Մանր" };
const DUE: Record<Lang, string> = { en: "To pay now", ru: "Доплатить", am: "Հավելավճար" };
const CHIP: Record<Lang, RegExp> = { en: /Paid ahead: 2,?000/, ru: /Предоплата: 2[\s.,]?000/, am: /Կանխավճար՝ 2[\s.,]?000/ };

const openReceipt = async (page: Page, lang: Lang, width: number, total: number, change: number, due: number) => {
  let stopBody: unknown = null;
  await signIn(page, lang, width);
  await seedBoard(page, { session: prepaidSeat });
  await page.route(at("/sessions/5/preview"), (r) => r.fulfill(json({ preview: preview(total, change, due) })));
  await page.route(at("/sessions/5/stop"), (r) => {
    stopBody = r.request().postDataJSON();
    return r.fulfill(json({
      session: runningSession({ status: "stopped", prepaid_amount: 2000, cash_received: 2000, cash_change: change, total_paid: total }),
      breakdown: preview(total, change, due),
      cash: { received: "2000.00", change: `${change}.00` },
    }));
  });
  await openBoard(page);
  return { body: () => stopBody };
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`left early: 500 back, big and green; the stop sends cash only (${lang}, ${width})`, async ({ page }) => {
      const stop = await openReceipt(page, lang, width, 1500, 500, 0);
      await expect(page.getByTestId("card-prepaid-chip")).toHaveText(CHIP[lang]);
      await page.locator('[data-action="stop"]').first().click();
      const change = page.getByTestId("receipt-prepaid-change");
      await expect(change).toBeVisible();
      await expect(change).toHaveAttribute("role", "status");
      await expect(change).toContainText(CHANGE[lang]);
      const figure = change.locator(".prepaid-change__figure");
      await expect(figure).toContainText("500");
      const look = await figure.evaluate((el) => ({ size: parseFloat(getComputedStyle(el).fontSize), color: getComputedStyle(el).color }));
      expect(look.size).toBeGreaterThanOrEqual(40);
      expect(look.color).toBe("rgb(34, 197, 94)"); // --color-success
      // Nothing due: no payment choice, no banknotes box.
      await expect(page.getByTestId("payment-editor")).toHaveCount(0);
      await expect(page.getByTestId("cash-received")).toHaveCount(0);
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[data-testid=receipt-prepaid]");
      await shot(page, `stop-change-${lang}-${width}`);
      await page.getByTestId("stop-confirm").click();
      await expect.poll(stop.body).toMatchObject({ payment_method: "cash", expected_total: 1500 });
      expect(stop.body()).not.toHaveProperty("cash_received");
      await expect(page.getByTestId("receipt-prepaid-change")).toContainText("500");
      await shot(page, `stop-change-done-${lang}-${width}`);
    });

    test(`stayed longer: amber «to pay» 500, the payment asks for the due (${lang}, ${width})`, async ({ page }) => {
      await openReceipt(page, lang, width, 2500, 0, 500);
      await page.locator('[data-action="stop"]').first().click();
      const due = page.getByTestId("receipt-prepaid-due");
      await expect(due).toContainText(DUE[lang]);
      await expect(due).toContainText("500");
      await expect(page.getByTestId("receipt-prepaid-change")).toHaveCount(0);
      await expect(page.getByTestId("payment-editor")).toBeVisible();
      // Nothing preselected (2026-11-18, owner): the banknotes box is cash's.
      await expect(page.getByTestId("cash-received")).toHaveCount(0);
      await page.getByTestId("pay-cash").click();
      await expect(page.getByTestId("cash-received")).toHaveAttribute("placeholder", /500/);
      await shot(page, `stop-due-${lang}-${width}`);
    });
  }
}

test("Start: «Оплачено вперёд» on a planned length sends prepaid:true (ru, 1280)", async ({ page }) => {
  let body: Record<string, unknown> | null = null;
  await signIn(page, "ru", 1280);
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
  // Offered on every start since 2026-11-17 (no limit: a named sum); with a length it pays the plan.
  await expect(page.getByTestId("prepaid-switch")).toHaveCount(1);
  await page.getByTestId("planned-duration-input-hours").fill("2");
  const sw = page.getByTestId("prepaid-switch");
  await expect(sw).toBeVisible();
  await page.getByTestId("unpaid-switch").click();
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("unpaid-switch")).toHaveAttribute("aria-checked", "false");
  await shot(page, "start-prepaid-ru-1280");
  await page.locator(".start-dialog").getByRole("button", { name: "Старт", exact: true }).click();
  await expect.poll(() => body).toMatchObject({ duration_minutes: 120, prepaid: true });
  expect(body).not.toHaveProperty("unpaid");
});

test("«+ Время» on a prepaid seat: «Оплачено сейчас» sends prepaid:true (en, 1280)", async ({ page }) => {
  let body: Record<string, unknown> | null = null;
  await signIn(page, "en", 1280);
  await seedBoard(page, { session: prepaidSeat });
  await page.route(at("/sessions/5/time-quote"), (r) => r.fulfill(json({ minutes: 30, charge: 500, hourly_rate: 1000, price_editable: false, is_free: false, standard_charge: 500 })));
  await page.route(at("/sessions/5/time"), (r) => {
    body = r.request().postDataJSON();
    return r.fulfill(json({ session: { ...prepaidSeat(), prepaid_amount: 2500 } }));
  });
  await openBoard(page);
  await page.locator('[data-action="add-time"]').first().click();
  await page.getByTestId("grant-duration-minutes").fill("30");
  await page.getByTestId("time-prepaid-switch").click();
  await shot(page, "time-paid-now-en-1280");
  await page.getByRole("button", { name: /Add 30 min/ }).click();
  await expect.poll(() => body).toEqual({ minutes: 30, prepaid: true });
});
