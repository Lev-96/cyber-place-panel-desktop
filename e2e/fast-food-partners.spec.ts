import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fmt, t } from "../src/i18n/translations";
import { LANGS, WIDTHS, fitsWidth, json, signIn, type Lang } from "./helpers/moneySession";

/**
 * «Быстрая Еда» and «Мои партнёры» (2026-11-18, owner), in a real browser,
 * en/ru/am × 1280/520, against the backend's own shapes (`PartnerResource`,
 * `PartnerSettlementResource`, `SalesSummaryResource`, `ProductResource`):
 *  - the partners screen: terms in words, the add dialog's exact body, the
 *    month's settlement with «Партнёр должен клубу» said plainly;
 *  - the products screen's fast-food tab: whose each product is, and a new
 *    one created from it carries `is_fast_food` and the picked partner;
 *  - the history: the fast-food card and both product dialogs, the records'
 *    comment, and a picked place read from the server with `place_id`;
 *  - a manager: no «Мои партнёры», no partner on the product form.
 * Nothing wider than the window, no raw dictionary key, no em dash.
 */

const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/sales-history-2026-11-18/shots");
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(400); // a dialog's entrance
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
};
const isBackend = (u: URL) => u.hostname !== "localhost" && u.hostname !== "127.0.0.1";
const at = (re: RegExp) => (u: URL) => isBackend(u) && re.test(u.pathname);

/** No raw key of the dictionaries this touches, no em dash. */
const noRawKeys = async (page: Page) => {
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/\b(partners|products|product|productHistory|sales|history|nav|revenue)\.[a-z][A-Za-z_.]+/);
  expect(text).not.toContain("—");
};
/** The page does not scroll sideways either. */
const noSideScroll = async (page: Page) => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
};

const PIZZA = {
  id: 7, company_id: 1, name: "Pizza House", phone: "+37491000000", note: null, terms: "percent", percent: "10.00", fixed_amount: null,
  active: true, archived: false, archived_at: null, products_count: 2,
};
const GRILL = {
  id: 8, company_id: 1, name: "Grill Brothers Family Kitchen", phone: null, note: "Pays on the 5th", terms: "fixed", percent: null, fixed_amount: "50000.00",
  active: true, archived: false, archived_at: null, products_count: 1,
};
const SETTLEMENT = {
  company_id: 1, month: "2026-11", branch_id: null, windows: [{ branch_id: 1, from: "2026-11-01T07:00:00+04:00", to: "2026-12-01T07:00:00+04:00" }],
  terms_note: "",
  partners: [
    { partner: { id: 7, name: "Pizza House", active: true, archived: false }, terms: { terms: "percent", percent: "10.00", fixed_amount: null },
      sales_total: "100000.00", units: 40, rows: [{ product_id: 21, name: "Pizza Margherita", quantity: 40, total: "100000.00" }],
      club_share: "10000.00", partner_share: "90000.00", partner_owes: false },
    { partner: { id: 8, name: "Grill Brothers Family Kitchen", active: true, archived: false }, terms: { terms: "fixed", percent: null, fixed_amount: "50000.00" },
      sales_total: "30000.00", units: 12, rows: [{ product_id: 23, name: "Kebab", quantity: 12, total: "30000.00" }],
      club_share: "50000.00", partner_share: "-20000.00", partner_owes: true },
  ],
  own: { sales_total: "8000.00", units: 9, rows: [{ product_id: 24, name: "Hot dog", quantity: 9, total: "8000.00" }] },
  totals: { sales_total: "130000.00", units: 52, club_share: "60000.00", partner_share: "70000.00", fast_food_total: "138000.00", fast_food_units: 61 },
};
const PRODUCTS = [
  { id: 20, branch_id: 1, name: "Cola", category: null, price: 500, is_active: true, kind: "regular", stock: null, is_fast_food: false, partner_id: null },
  { id: 21, branch_id: 1, name: "Pizza Margherita", category: null, price: 2500, is_active: true, kind: "regular", stock: null, is_fast_food: true, partner_id: 7 },
  { id: 24, branch_id: 1, name: "Hot dog", category: null, price: 900, is_active: true, kind: "regular", stock: null, is_fast_food: true, partner_id: null },
  { id: 30, branch_id: 1, name: "Cue", category: null, price: 700, is_active: true, kind: "additional", stock: null },
];

/** The company, the branch, the partners and their month, the catalogue: the routes these screens read. */
const seed = async (page: Page) => {
  const posted: { path: string; method: string; body: Record<string, unknown> }[] = [];
  await page.route(at(/^\/company$/), (r: Route) => r.fulfill(json({ data: [{ id: 1, name: "Cyber One", email: "c@c.com" }], meta: { total: 1 } })));
  await page.route(at(/^\/branches\/1$/), (r: Route) => r.fulfill(json({ branch: { id: 1, company_id: 1, address: "Abovyan 1", city: "Yerevan" } })));
  await page.route(at(/^\/companies\/1\/partners$/), (r: Route) => {
    if (r.request().method() === "GET") return r.fulfill(json({ data: [PIZZA, GRILL] }));
    const body = r.request().postDataJSON() as Record<string, unknown>;
    posted.push({ path: "/companies/1/partners", method: "POST", body });
    return r.fulfill(json({ data: { ...PIZZA, id: 9, ...body, percent: "12.50" } }, 201));
  });
  await page.route(at(/^\/companies\/1\/partners\/settlement$/), (r: Route) => r.fulfill(json({ data: SETTLEMENT })));
  await page.route(at(/^\/products$/), (r: Route) => {
    if (r.request().method() === "GET") return r.fulfill(json({ data: PRODUCTS }));
    const body = r.request().postDataJSON() as Record<string, unknown>;
    posted.push({ path: "/products", method: "POST", body });
    return r.fulfill(json({ product: { id: 40, ...body } }, 201));
  });
  return posted;
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`«Мои партнёры»: list, add, monthly settlement (${lang}, ${width})`, async ({ page }) => {
      await signIn(page, lang, width);
      const posted = await seed(page);
      // The owner's menu has the entry.
      await expect(page.locator("nav.sidebar-nav a[href='#/partners']")).toHaveCount(1);
      await page.goto("/#/partners");

      await expect(page.getByTestId("partner-row-7")).toBeVisible();
      await expect(page.getByTestId("partner-row-7").getByTestId("partner-terms")).toHaveText(fmt(t("partners.termsPercent", lang), "10"));
      await expect(page.getByTestId("partner-row-8").getByTestId("partner-terms")).toContainText(/50[\s\u00a0,.]?000/);
      await expect(page.getByTestId("partner-row-7")).toContainText(fmt(t("partners.productsCount", lang), 2));
      await noRawKeys(page);
      await fitsWidth(page, "[data-testid=partners-screen]");
      await noSideScroll(page);
      await shot(page, `partners-list-${lang}-${width}`);

      // ── a new partner on percent terms: the exact body ──
      await page.getByTestId("partner-add").click();
      const dialog = page.getByTestId("partner-dialog");
      await dialog.getByTestId("partner-name").fill("Burger Lab");
      await dialog.getByTestId("partner-percent").fill("12,5");
      await expect(dialog).toContainText(t("partners.percentHint", lang));
      await noRawKeys(page);
      await fitsWidth(page, "[data-testid=partner-dialog]");
      await shot(page, `partners-add-${lang}-${width}`);
      await dialog.getByTestId("partner-save").click();
      await expect(dialog).toHaveCount(0);
      expect(posted.find((p) => p.path === "/companies/1/partners")?.body).toEqual({
        name: "Burger Lab", phone: null, note: null, terms: "percent", percent: 12.5,
      });

      // ── the month ──
      await page.getByRole("tab", { name: t("partners.tabSettlement", lang) }).click();
      const now = new Date();
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      await expect(page.getByTestId("settlement-period")).toHaveText(
        fmt(t("revenue.periodRange", lang), `01.${mm}.${now.getFullYear()}`, `${last}.${mm}.${now.getFullYear()}`),
      );
      const pizza = page.getByTestId("settlement-partner-7");
      await expect(pizza.getByTestId("settlement-club")).toContainText(t("partners.toClub", lang));
      await expect(pizza.getByTestId("settlement-club")).toContainText(/10[\s ,.]?000/);
      await expect(pizza.getByTestId("settlement-partner")).toContainText(/90[\s ,.]?000/);
      await expect(pizza.getByTestId("settlement-owes")).toHaveCount(0);
      const grill = page.getByTestId("settlement-partner-8");
      await expect(grill.getByTestId("settlement-owes")).toContainText(fmt(t("partners.owes", lang), "").trim());
      await expect(grill.getByTestId("settlement-owes")).toContainText(/20[\s ,.]?000/);
      await expect(page.getByTestId("settlement-own")).toContainText(t("partners.ownTitle", lang));
      await expect(page.getByTestId("settlement-note")).toHaveText(t("partners.termsNote", lang));
      await noRawKeys(page);
      await fitsWidth(page, "[data-testid=partner-settlement]");
      await noSideScroll(page);
      await shot(page, `partners-settlement-${lang}-${width}`);
    });

    test(`products: the «Быстрая Еда» tab (${lang}, ${width})`, async ({ page }) => {
      await signIn(page, lang, width);
      const posted = await seed(page);
      await page.goto("/#/branches/1/products");
      await expect(page.getByTestId("product-row").first()).toBeVisible();
      await expect(page.getByTestId("product-row")).toHaveCount(1); // «Товары»: Cola only

      await page.getByRole("tab", { name: t("products.tabFastFood", lang) }).click();
      await expect(page.getByTestId("product-row")).toHaveCount(2);
      await expect(page.getByTestId("product-partner-name")).toHaveText([
        fmt(t("products.partnerOf", lang), "Pizza House"),
        t("product.partnerOwn", lang),
      ]);
      await noRawKeys(page);
      await fitsWidth(page, "main");
      await noSideScroll(page);
      await shot(page, `products-fast-food-${lang}-${width}`);

      await page.getByTestId("product-new").click();
      const form = page.locator(".cp-modal-dialog form");
      await expect(form.getByRole("switch")).toBeChecked();
      await form.locator(".cp-mli-row input").first().fill("Pizza Pepperoni");
      await form.locator('input[inputmode="decimal"]').fill("2800");
      await form.getByTestId("product-partner").selectOption("7");
      await noRawKeys(page);
      await fitsWidth(page, ".cp-modal-dialog");
      await shot(page, `products-fast-food-form-${lang}-${width}`);
      await form.getByRole("button", { name: t("action.save", lang), exact: true }).click();
      await expect(form).toHaveCount(0);
      expect(posted.find((p) => p.path === "/products")?.body).toMatchObject({
        name: "Pizza Pepperoni", price: 2800, kind: "regular", is_fast_food: true, partner_id: 7,
      });
    });

    test(`history: the fast-food card, product dialogs, comments, one place (${lang}, ${width})`, async ({ page }) => {
      await signIn(page, lang, width);
      const reads: URL[] = [];
      page.on("request", (req) => {
        const u = new URL(req.url());
        if (isBackend(u) && u.pathname === "/branches/1/sales-summary") reads.push(u);
      });
      await page.route(at(/^\/places$/), (r: Route) => r.fulfill(json({ data: [
        { id: 3, branch_id: 1, number: 3, name: null, type: "standard", status: "active", platform: "ps5" },
        { id: 4, branch_id: 1, number: 4, name: "Corner", type: "standard", status: "active", platform: "ps5" },
      ] })));
      await page.evaluate(() => { window.location.hash = "#/branches/1/sessions/history"; });

      const card = page.getByTestId("sales-fast-food");
      await expect(card).toContainText(t("sales.fastFood", lang));
      await expect(card).toContainText(fmt(t("sales.productsUnits", lang), 2));
      await expect(card).toContainText(t("sales.fastFoodHint", lang));
      await noRawKeys(page);
      await fitsWidth(page, "[data-testid=sales-summary]");
      await noSideScroll(page);
      await shot(page, `history-cards-${lang}-${width}`);

      await card.click();
      const dialog = page.getByTestId("sales-products-dialog");
      await expect(dialog.getByTestId("sales-product-row")).toHaveCount(1);
      await expect(dialog.getByTestId("sales-product-row")).toContainText("Burger");
      await fitsWidth(page, "[data-testid=sales-products-dialog]");
      await shot(page, `history-fast-food-dialog-${lang}-${width}`);
      await dialog.getByRole("button", { name: t("action.close", lang), exact: true }).click();

      await page.getByTestId("sales-products").click();
      await expect(page.getByTestId("sales-products-dialog").getByTestId("sales-product-row")).toHaveCount(2);
      await shot(page, `history-products-dialog-${lang}-${width}`);
      await page.getByTestId("sales-products-dialog").getByRole("button", { name: t("action.close", lang), exact: true }).click();

      // A record's comment.
      await page.getByTestId("sales-places").click();
      await expect(page.getByTestId("sales-line-place-6")).toContainText(fmt(t("sales.note", lang), "Card of Aram"));
      await fitsWidth(page, "[data-testid=sales-lines]");
      await shot(page, `history-records-note-${lang}-${width}`);
      await page.getByTestId("sales-lines").getByRole("button", { name: t("action.close", lang), exact: true }).click();

      // One place: the server's figures for it.
      expect(reads.some((u) => u.searchParams.has("place_id"))).toBe(false);
      await page.getByTestId("history-place").selectOption("4");
      await expect(page.getByTestId("sales-no-till")).toHaveText(t("sales.noTillForPlace", lang));
      await expect(page.getByTestId("sales-till")).toHaveCount(0);
      await expect(page.getByTestId("sales-grand")).toContainText(t("sales.grandPlaceHint", lang));
      await expect.poll(() => reads.some((u) => u.searchParams.get("place_id") === "4")).toBe(true);
      await noRawKeys(page);
      await fitsWidth(page, "[data-testid=sales-summary]");
      await noSideScroll(page);
      await shot(page, `history-place-${lang}-${width}`);
    });
  }
}

for (const lang of LANGS) {
  test(`a manager: no «Мои партнёры», no partner on the product (${lang})`, async ({ page }) => {
    const partnerReads: string[] = [];
    page.on("request", (req) => {
      const u = new URL(req.url());
      if (isBackend(u) && u.pathname.includes("/partners")) partnerReads.push(u.pathname);
    });
    await signIn(page, lang, 1280, "manager");
    await seed(page);
    await expect(page.locator("nav.sidebar-nav a[href='#/partners']")).toHaveCount(0);
    await expect(page.locator("nav.sidebar-nav")).not.toContainText(t("nav.partners", lang));

    await page.goto("/#/branches/1/products");
    await page.getByRole("tab", { name: t("products.tabFastFood", lang) }).click();
    await expect(page.getByTestId("product-row")).toHaveCount(2);
    await expect(page.getByTestId("product-partner-name")).toHaveCount(0);
    await page.getByTestId("product-new").click();
    await expect(page.getByTestId("product-fast-food")).toBeVisible();
    await expect(page.getByTestId("product-partner")).toHaveCount(0);

    // The route itself is closed too.
    await page.goto("/#/partners");
    await expect(page.getByTestId("partners-screen")).toHaveCount(0);
    expect(partnerReads).toEqual([]);
  });
}
