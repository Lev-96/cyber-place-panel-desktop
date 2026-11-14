import { expect, test, type Page } from "@playwright/test";
import { installBackendMocks, seedLanguageChosen } from "./helpers/mockBackend";

/**
 * B5 (audit 2026-11-13): Prices → the venue's extra item showed a raw «{0}» in
 * the charge select, and both selects were pinned at 180px and clipped their
 * text. On the real bundle: the item's name is in the options, and the select
 * is as wide as the chosen sentence on a desk window, and never wider than its
 * row on the minimum one. `EXTRA_SHOTS=<dir>` also writes screenshots.
 */
const isBackend = (url: URL): boolean => url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const SHOTS = process.env.EXTRA_SHOTS;
type Lang = "en" | "ru" | "am";

const settings = {
  branch_id: 1, money_rounding_step: 0, money_rounding_mode: "up", joystick_price: 500, joystick_included: 2,
  joystick_charged_slots: "3,4", joystick_pricing_mode: "fixed", joystick_price_4: null, joystick_max_slot: 4,
  joystick_strategy_mode: "fixed_price", pause_limit_minutes: null, vip_min_charge_enabled: false,
  extra_item_name: "Фишки", extra_item_price: 500, extra_item_charge_mode: "once", extra_item_pricing_mode: "fixed",
  extra_item_included: null, extra_item_max: null, extra_item_charged_units: null, extra_item_price_next: null,
};

const openPrices = async (page: Page, lang: Lang, width: number) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedLanguageChosen(page, lang);
  await installBackendMocks(page, { role: "company_owner", company_id: 1, name: "Owner One" });
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1/billing-settings", (r) => r.fulfill(json({ settings })));
  await page.route((u) => isBackend(u) && u.pathname === "/branches/1", (r) => r.fulfill(json({
    branch: { id: 1, name: "Hall", company_id: 1, address: "Abovyan 5", city: "Yerevan", price_for_branch: { id: 1, branch_id: 1 } },
  })));
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("o@o");
  await page.getByPlaceholder(/•/).fill("ok");
  await page.getByRole("button", { name: { en: "Sign in", ru: "Вход", am: "Մուտք" }[lang], exact: true }).click();
  await expect(page.getByText("Owner One").first()).toBeVisible();
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/#/branches/1/tariffs");
  await expect(page.locator(".branch-extra-item__select").first()).toBeVisible();
};

const selects = (page: Page) => page.evaluate(() => {
  const ctx = document.createElement("canvas").getContext("2d")!;
  return [...document.querySelectorAll<HTMLSelectElement>(".branch-extra-item__select")].map((s) => {
    const cs = getComputedStyle(s);
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const chosen = s.options[s.selectedIndex]?.textContent ?? "";
    const need = ctx.measureText(chosen).width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    const box = s.getBoundingClientRect();
    const row = (s.closest(".row") as HTMLElement).getBoundingClientRect();
    return {
      options: [...s.options].map((o) => o.textContent ?? ""),
      width: box.width,
      need,
      insideRow: box.left >= row.left - 1 && box.right <= row.right + 1,
    };
  });
});

for (const lang of ["en", "ru", "am"] as const) {
  test(`${lang}: the charge options name the item and are not clipped`, async ({ page }) => {
    await openPrices(page, lang, 1280);
    const list = await selects(page);
    expect(list).toHaveLength(2);
    const all = list.flatMap((s) => s.options).join(" | ");
    expect(all).not.toMatch(/\{\d\}/);
    expect(list[1].options.filter((o) => o.includes("Фишки"))).toHaveLength(2);
    for (const s of list) {
      // Canvas text metrics differ from the select's own layout by a pixel or two.
      expect(s.width).toBeGreaterThanOrEqual(s.need - 4);
      expect(s.insideRow).toBe(true);
    }
    if (SHOTS) await page.locator(".branch-extra-item__select").nth(1).locator("xpath=ancestor::form[1]").screenshot({ path: `${SHOTS}/extra-item-${lang}-1280.png` });
  });
}

test("ru at the 520px minimum: the selects stay inside their row, nothing of the form runs past the page", async ({ page }) => {
  await openPrices(page, "ru", 520);
  for (const s of await selects(page)) expect(s.insideRow).toBe(true);
  // Scoped to this form: the price matrix above it is another section (its
  // own 520px overflow is reported separately, not part of B5).
  const wide = await page.evaluate(() => {
    const main = document.querySelector("main.main") as HTMLElement;
    const form = document.querySelector(".branch-extra-item__select")!.closest("form") as HTMLElement;
    const edge = main.getBoundingClientRect().right;
    return [form, ...form.querySelectorAll<HTMLElement>("*")]
      .filter((el) => el.getBoundingClientRect().right > edge + 1)
      .map((el) => `${el.tagName}.${el.className}`);
  });
  expect(wide).toEqual([]);
  if (SHOTS) await page.locator(".branch-extra-item__select").nth(1).locator("xpath=ancestor::form[1]").screenshot({ path: `${SHOTS}/extra-item-ru-520.png` });
});
