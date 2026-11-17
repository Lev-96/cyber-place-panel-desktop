import { expect, test, type Page } from "@playwright/test";
import { LANGS, WIDTHS, at, json, noRawKeys, openBoard, runningSession, seedBoard, shot, signIn, type Lang } from "./helpers/moneySession";

/**
 * An additional item on «Изменение тарифа» (2026-11-17, owner: the joysticks'
 * principle). The owner's example: a PlayStation at 2 500/h with a pad out at
 * 500/h is 3 000/h; handing out chips at 500/h makes it 3 500/h, and the
 * cashier is told so. Out, the line is handed BACK (`PATCH {returned:true}`),
 * never removed. Figures and lines are the server's (AdditionalItemTariffTest).
 */

const chips = { id: 40, branch_id: 1, name: "Chips", category: "Rentals", price: 500, is_active: true, kind: "additional", pricing_mode: "hourly" };
const cue = { id: 41, branch_id: 1, name: "Cue", category: "Rentals", price: 700, is_active: true, kind: "additional", pricing_mode: "fixed" };
const pad = { slot: 3, price: "500.00", is_hourly: true, is_charged: true, started_at: new Date(Date.now() - 10 * 60_000).toISOString(), stopped_at: null };
const outLine = {
  id: 9, session_id: 5, name: "Chips", price: "500.00", qty: 1, product_id: 40, is_hourly: true, is_extra: false,
  kind: null, returned_at: null, line_total: 0, minutes: 0, created_at: new Date().toISOString(), unpaid_at: null,
};

const TAB: Record<Lang, string> = { en: "Additional items", ru: "Дополнительные предметы", am: "Լրացուցիչ իրեր" };
const PICKER: Record<Lang, string> = { en: "Choose from the list", ru: "Выбрать из списка", am: "Ընտրել ցանկից" };
const ADD: Record<Lang, string> = { en: "Add", ru: "Добавить", am: "Ավելացնել" };
const RATE: Record<Lang, RegExp> = {
  en: /Rate now: 3[\s.,  ]?500.*\/h/,
  ru: /Тариф сейчас: 3[\s.,  ]?500.*\/ч/,
  am: /Ընթացիկ սակագին: 3[\s.,  ]?500.*\/ժ/,
};
const PER_HOUR: Record<Lang, string> = { en: "/h", ru: "/ч", am: "/ժ" };
const RETURN: Record<Lang, string> = { en: "Return", ru: "Вернуть", am: "Վերադարձնել" };

const open = async (page: Page, lang: Lang, width: number, items: unknown[] = []) => {
  let current = runningSession({ hourly_rate: 2500, tariff_hourly_rate: 2500, joysticks: [pad], joystick_count: 3, items });
  const calls: { post: unknown[]; patch: unknown[] } = { post: [], patch: [] };
  await signIn(page, lang, width);
  await seedBoard(page, { session: () => current });
  await page.route((u) => u.hostname !== "localhost" && u.pathname === "/products", (r) => r.fulfill(json({ data: [chips, cue] })));
  await page.route(at("/sessions/5/items"), (r) => {
    calls.post.push(r.request().postDataJSON());
    current = runningSession({ hourly_rate: 2500, tariff_hourly_rate: 2500, joysticks: [pad], joystick_count: 3, items: [outLine] });
    // The answer carries the items, not the pads — as the server's does.
    return r.fulfill(json({ session: { ...current, joysticks: undefined } }, 201));
  });
  await page.route(at("/sessions/5/items/9"), (r) => {
    calls.patch.push(r.request().postDataJSON());
    current = runningSession({ hourly_rate: 2500, tariff_hourly_rate: 2500, joysticks: [pad], joystick_count: 3,
      items: [{ ...outLine, returned_at: new Date().toISOString() }] });
    return r.fulfill(json({ session: current }));
  });
  await openBoard(page);
  return calls;
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`an item on «Изменение тарифа»: «500/h», handed out, the rate now 3 500 (${lang}, ${width})`, async ({ page }) => {
      const calls = await open(page, lang, width);
      await page.locator('[data-action="add-item"]').first().click();
      await page.getByText(PICKER[lang], { exact: true }).click();
      await page.getByRole("tab", { name: new RegExp(`^${TAB[lang]}`) }).click();

      const row = page.locator(".basket-extras__row", { hasText: "Chips" });
      await expect(row.locator(".basket-extras__price")).toContainText(PER_HOUR[lang]);
      // A fixed item is a price, never a rate.
      await expect(page.locator(".basket-extras__row", { hasText: "Cue" }).locator(".basket-extras__price")).not.toContainText(PER_HOUR[lang]);
      await noRawKeys(page, "[role=dialog]");
      await shot(page, `additional-tariff-dialog-${lang}-${width}`);

      await page.getByLabel(`${ADD[lang]}: Chips`).click();
      await page.getByTestId("items-confirm").click();
      await expect.poll(() => calls.post).toEqual([{ items: [{ product_id: 40, qty: 1 }] }]);
      await expect(page.getByText(RATE[lang]).first()).toBeVisible();
      await shot(page, `additional-tariff-rate-${lang}-${width}`);
    });

    test(`out, it is handed back — not removed (${lang}, ${width})`, async ({ page }) => {
      const calls = await open(page, lang, width, [outLine]);
      await page.locator('[data-action="add-item"]').first().click();
      const back = page.getByTestId("bill-line-return");
      await expect(back).toHaveText(RETURN[lang]);
      await noRawKeys(page, "[role=dialog]");
      await shot(page, `additional-tariff-return-${lang}-${width}`);
      await back.click();
      await expect.poll(() => calls.patch).toEqual([{ returned: true }]);
      await expect(page.getByTestId("bill-line-returned")).toHaveCount(1);
      await expect(back).toHaveCount(0);
    });
  }
}
