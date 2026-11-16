import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fmt, t } from "../src/i18n/translations";
import { LANGS, WIDTHS, json, signIn, type Lang } from "./helpers/moneySession";

/**
 * Products → stock (2026-11-16), against the backend's own contract
 * (`ProductStockIntakeTest`): every product sold by the unit says «Остаток: N»
 * or «Без учёта» (red below zero) and the list carries the server's total;
 * adding «Кола» with a quantity when «Кола» is there at another price asks
 * («Такой товар уже есть»), and «Добавить к остатку» answers with the SAME
 * press id; the owner recounts from the stock dialog. en/ru/am × 1280/520,
 * nothing wider than the window, no raw dictionary key, no em dash.
 */

const SHOTS = path.join(os.homedir(), "cyber-place-local/reports/history-filter-split-stock-2026-11-15/stock");
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};
const isBackend = (u: URL) => u.hostname !== "localhost" && u.hostname !== "127.0.0.1";

const COLA = { id: 1, branch_id: 1, name: "Кола", category: "Напитки", price: 500, is_active: true, kind: "regular", stock: 15 };
const PRODUCTS = [
  COLA,
  { id: 2, branch_id: 1, name: "Чипсы", category: null, price: 300, is_active: true, kind: "regular", stock: -2 },
  { id: 3, branch_id: 1, name: "Вода", category: null, price: 200, is_active: true, kind: "regular", stock: null },
  { id: 4, branch_id: 1, name: "Кий", category: null, price: 700, is_active: true, kind: "additional", stock: null },
];
const META = { units: 13, tracked: 2, untracked: 1, negative: 1 };
const MINUS = "−";

/** No element sticks out to the right, and the page does not scroll sideways. */
const noOverflow = async (page: Page) => {
  const out = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const wide = Array.from(document.querySelectorAll<HTMLElement>("main *, .cp-modal-dialog *"))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1; })
      .map((el) => `${el.tagName}.${el.className}`).slice(0, 5);
    return { wide, page: document.documentElement.scrollWidth - vw };
  });
  expect(out.wide).toEqual([]);
  expect(out.page).toBeLessThanOrEqual(0);
};

/** No raw key of the stock/product dictionary, no em dash. */
const noRawKeys = async (page: Page) => {
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/\b(stock|product|products|productHistory)\.[a-z][A-Za-z_.]+/);
  expect(text).not.toContain("—");
};

const open = async (page: Page, lang: Lang, width: number) => {
  const creates: Record<string, unknown>[] = [];
  const stocks: { id: string; body: Record<string, unknown> }[] = [];
  await signIn(page, lang, width);
  await page.route((u) => isBackend(u) && u.pathname === "/products", (r: Route) => {
    if (r.request().method() === "GET") return r.fulfill(json({ data: PRODUCTS, meta: { stock: META } }));
    const body = r.request().postDataJSON() as Record<string, unknown>;
    creates.push(body);
    if (body.on_existing === "add") {
      return r.fulfill(json({ product: { ...COLA, stock: 25 }, merged: true, stock_change: { before: 15, after: 25, delta: 10 } }));
    }
    return r.fulfill(json({
      message: "«Кола» уже есть в каталоге.", code: "product_exists", name: "Кола",
      matches: [{ id: 1, name: "Кола", i18n: null, category: "Напитки", price: "500.00", stock: 15, is_active: true }],
      choices: ["add", "add_and_reprice"],
    }, 409));
  });
  await page.route((u) => isBackend(u) && /^\/products\/\d+\/stock$/.test(u.pathname), (r: Route) => {
    const id = new URL(r.request().url()).pathname.split("/")[2];
    const body = r.request().postDataJSON() as Record<string, unknown>;
    stocks.push({ id, body });
    return r.fulfill(json({ product: { ...COLA, stock: 12 }, stock_change: { before: 15, after: 12, delta: -3 } }));
  });
  await page.goto("/#/branches/1/products");
  await expect(page.getByTestId("product-stock").first()).toBeVisible();
  return { creates, stocks };
};

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`products: each count, the total, a merge and a recount (${lang}, ${width})`, async ({ page }) => {
      const { creates, stocks } = await open(page, lang, width);

      // ── the list ─────────────────────────────────────────────────────
      await expect(page.getByTestId("product-stock")).toHaveText([
        fmt(t("stock.left", lang), "15"),
        fmt(t("stock.left", lang), `${MINUS}2`),
        t("stock.notCounted", lang),
      ]);
      await expect(page.getByTestId("product-stock").nth(1)).toHaveClass(/is-negative/);
      await expect(page.getByTestId("product-stock-total")).toContainText(fmt(t("stock.total", lang), "13"));
      await expect(page.getByTestId("product-stock-negative")).toHaveText(fmt(t("stock.negative", lang), 1));
      await noOverflow(page);
      await noRawKeys(page);
      await shot(page, `products-list-${lang}-${width}`);

      // ── «Кола» × 10 at another price: the question, then the answer ──
      await page.getByRole("button", { name: t("products.new", lang), exact: true }).first().click();
      const form = page.locator(".cp-modal-dialog form");
      await form.locator(".cp-mli-row input").first().fill("Кола");
      await form.locator('input[inputmode="decimal"]').fill("600");
      await page.getByTestId("product-quantity").fill("10");
      await expect(form).toContainText(t("product.quantityHint", lang));
      await form.getByRole("button", { name: t("action.save", lang), exact: true }).click();

      const merge = page.getByTestId("product-merge");
      await expect(merge).toBeVisible();
      await expect(merge).toContainText(t("product.exists.title", lang));
      await expect(merge).toContainText(t("product.exists.hint", lang));
      await expect(page.getByTestId("product-merge-add")).toHaveText(t("product.exists.add", lang));
      await expect(page.getByTestId("product-merge-reprice")).toContainText(fmt(t("product.exists.addReprice", lang), "").trim());
      expect(creates[0]).toMatchObject({ name: "Кола", price: 600, stock: 10, kind: "regular" });
      // The question is brought into view with its buttons, at 520 as at 1280.
      await expect(page.getByTestId("product-merge-add")).toBeInViewport();
      await noOverflow(page);
      await noRawKeys(page);
      await shot(page, `products-merge-${lang}-${width}`);

      await page.getByTestId("product-merge-add").click();
      await expect(page.getByTestId("product-merge")).toHaveCount(0);
      expect(creates[1]).toMatchObject({ stock: 10, on_existing: "add", existing_id: 1 });
      expect(creates[1].client_request_id).toBe(creates[0].client_request_id);
      await expect(page.locator(".cp-toast-success").last()).toContainText(fmt(t("product.mergedToast", lang), "Кола", "15 → 25 (+10)"));
      await shot(page, `products-merged-toast-${lang}-${width}`);

      // ── the owner recounts ───────────────────────────────────────────
      await page.getByTestId("product-stock-button").first().click();
      const dialog = page.getByTestId("product-stock-dialog");
      await expect(dialog).toBeVisible();
      await expect(page.getByTestId("product-stock-now")).toHaveText(fmt(t("stock.now", lang), "15"));
      await page.getByTestId("product-stock-action-set").click();
      await page.getByTestId("product-stock-qty").fill("12");
      await noOverflow(page);
      await noRawKeys(page);
      await shot(page, `products-stock-dialog-${lang}-${width}`);
      await page.getByTestId("product-stock-confirm").click();
      await expect(dialog).toHaveCount(0);
      expect(stocks).toEqual([{ id: "1", body: { action: "set", stock: 12, client_request_id: expect.any(String) } }]);
      await expect(page.locator(".cp-toast-success").last()).toContainText(fmt(t("stock.done", lang), "Кола", `15 → 12 (${MINUS}3)`));
    });
  }
}

test("a manager receives goods and is told who recounts (ru, 1280)", async ({ page }) => {
  const stocks: Record<string, unknown>[] = [];
  await signIn(page, "ru", 1280, "manager");
  await page.route((u) => isBackend(u) && u.pathname === "/products", (r) => r.fulfill(json({ data: PRODUCTS, meta: { stock: META } })));
  await page.route((u) => isBackend(u) && u.pathname === "/products/1/stock", (r) => {
    stocks.push(r.request().postDataJSON() as Record<string, unknown>);
    return r.fulfill(json({ product: { ...COLA, stock: 25 }, stock_change: { before: 15, after: 25, delta: 10 } }));
  });
  await page.goto("/#/branches/1/products");
  await page.getByTestId("product-stock-button").first().click();
  await expect(page.getByTestId("product-stock-action")).toHaveCount(0);
  await expect(page.getByTestId("product-stock-dialog")).toContainText(t("stock.ownerOnly", "ru"));
  await page.getByTestId("product-stock-qty").fill("10");
  await page.getByTestId("product-stock-confirm").click();
  expect(stocks).toEqual([{ action: "add", qty: 10, client_request_id: expect.any(String) }]);
  await shot(page, "products-stock-manager-ru-1280");
});
