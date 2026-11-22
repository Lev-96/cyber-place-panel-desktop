import { expect, test, type Page } from "@playwright/test";
import { LANGS, WIDTHS, at, fitsWidth, json, noRawKeys, openBoard, runningSession, seedBoard, shot, signIn, type Lang } from "./helpers/moneySession";
import { dismissUnpaidNotice } from "./helpers/unpaidNotice";

/**
 * B (2026-11-15): products handed over NOT paid yet. Shapes as in
 * SessionItemUnpaidTest (Cola 500): the card's chip is the server's
 * `unpaid_items_total`; the add-item dialog tags the line and «Оплачено» sends
 * `PATCH {unpaid:false}`; the switch sends `unpaid: true` per product line; the
 * Stop receipt tags the line and says what of it is not paid. No money moves.
 */

const UNPAID_AT = "2026-11-15T14:00:00Z";
const cola = { id: 3, branch_id: 1, name: "Cola", category: "Drinks", price: 500, is_active: true };
const itemsBefore = [
  { id: 7, session_id: 5, name: "Cola", price: "500.00", qty: 1, product_id: 3, unpaid_at: null },
  { id: 8, session_id: 5, name: "Cola", price: "500.00", qty: 2, product_id: 3, unpaid_at: UNPAID_AT },
];
const itemsAfter = [{ id: 7, session_id: 5, name: "Cola", price: "500.00", qty: 3, product_id: 3, unpaid_at: null }];

const CHIP: Record<Lang, RegExp> = { en: /Not paid: 1,?000/, ru: /Не оплачено: 1[\s.,]?000/, am: /Չվճարված՝ 1[\s.,]?000/ };
const PICKER: Record<Lang, string> = { en: "Choose from the list", ru: "Выбрать из списка", am: "Ընտրել ցանկից" };
const ADD: Record<Lang, string> = { en: "Add", ru: "Добавить", am: "Ավելացնել" };

const open = async (page: Page, lang: Lang, width: number) => {
  let current = runningSession({ items: itemsBefore, unpaid_items_total: 1000 });
  const calls: { patch: unknown[]; post: unknown[] } = { patch: [], post: [] };
  await signIn(page, lang, width);
  await seedBoard(page, { session: () => current });
  await page.route((u) => u.hostname !== "localhost" && u.pathname === "/products", (r) => r.fulfill(json({ data: [cola] })));
  await page.route(at("/sessions/5/items/8"), (r) => {
    calls.patch.push(r.request().postDataJSON());
    current = runningSession({ items: itemsAfter, unpaid_items_total: 0 });
    return r.fulfill(json({ session: current }));
  });
  await page.route(at("/sessions/5/items"), (r) => {
    calls.post.push(r.request().postDataJSON());
    return r.fulfill(json({ session: current }, 201));
  });
  await page.route(at("/sessions/5/preview"), (r) => r.fulfill(json({ preview: {
    mode: "open", is_free: false, is_unlimited: true, elapsed_minutes: 30, time_cost: 500, hourly_rate: 1000, package_name: null,
    items: [
      { id: 7, name: "Cola", price: 500, qty: 1, line_total: 500, unpaid: false },
      { id: 8, name: "Cola", price: 500, qty: 2, line_total: 1000, unpaid: true },
    ],
    items_total: 1500, unpaid_items_total: 1000, joysticks: [], joysticks_total: 0, subtotal: 2000, gross_total: 2000, total: 2000,
    priced_at: new Date().toISOString(), prepaid: null,
  } })));
  await openBoard(page);
  return calls;
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`unpaid products: chip, tag, «Оплачено», the switch, the receipt (${lang}, ${width})`, async ({ page }) => {
      const calls = await open(page, lang, width);
      const chip = page.getByTestId("card-unpaid-chip");
      await expect(chip).toHaveText(CHIP[lang]);
      // First on the one-line tariff line: wholly inside the card, never cut off.
      const inside = await chip.evaluate((el) => {
        const c = el.closest(".place-cell")!.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const line = el.parentElement!.getBoundingClientRect();
        return r.left >= c.left && r.right <= c.right && r.right <= line.right + 0.5;
      });
      expect(inside).toBe(true);
      await shot(page, `item-unpaid-card-${lang}-${width}`, page.locator(".place-cell").first());

      // The add-item dialog: the line is tagged, «Оплачено» marks it paid.
      await page.locator('[data-action="add-item"]').first().click();
      await dismissUnpaidNotice(page);
      const tag = page.getByTestId("bill-line-unpaid");
      await expect(tag).toHaveCount(1);
      await noRawKeys(page, "[role=dialog]");
      await shot(page, `item-unpaid-dialog-${lang}-${width}`);
      await page.getByTestId("bill-line-mark-paid").click();
      await expect.poll(() => calls.patch).toEqual([{ unpaid: false }]);
      await expect(tag).toHaveCount(0);

      // The switch, ON by default (2026-11-22, owner): what this basket hands
      // over goes on the bill unpaid unless the cashier turns it off.
      await page.getByText(PICKER[lang], { exact: true }).click();
      await page.getByLabel(`${ADD[lang]}: Cola`).click();
      const sw = page.getByTestId("items-unpaid-switch");
      await expect(sw).toHaveAttribute("aria-checked", "true");
      await shot(page, `item-unpaid-switch-${lang}-${width}`);
      await page.getByTestId("items-confirm").click();
      await expect.poll(() => calls.post).toEqual([{ items: [{ product_id: 3, qty: 1, unpaid: true }] }]);
    });

    test(`the Stop receipt tags the unpaid line and says what is not paid (${lang}, ${width})`, async ({ page }) => {
      await open(page, lang, width);
      await page.locator('[data-action="stop"]').first().click();
      await expect(page.getByTestId("receipt-line-unpaid")).toHaveCount(1);
      await expect(page.getByTestId("receipt-unpaid-total")).toContainText("1");
      await noRawKeys(page, "[role=dialog]");
      await fitsWidth(page, "[data-testid=receipt-items]");
      await shot(page, `item-unpaid-receipt-${lang}-${width}`);
    });
  }
}
