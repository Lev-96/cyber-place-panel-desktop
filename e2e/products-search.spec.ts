import { expect, test } from "@playwright/test";
import { t } from "../src/i18n/translations";
import { LANGS, WIDTHS, at, json, signIn } from "./helpers/moneySession";

/**
 * The Products screen's search in any language (2026-11-20, owner: «не важно
 * на каком языке десктоп, всё равно должен понимать фильтр»), on the real
 * bundle. A product is typed once and the backend translates it into the
 * other locales (`ProductResource` = the model's row with its `i18n` bag);
 * the search finds it by what was typed or any translation, any letter case,
 * whatever the panel's language. The same word gives the same row in en, ru
 * and am.
 */
const PRODUCTS = [
  {
    id: 20, branch_id: 1, name: "Кола", category: "Напитки", price: 500, is_active: true, kind: "regular", stock: null,
    is_fast_food: false, partner_id: null, source_locale: "ru",
    i18n: { name: { en: "Cola", ru: "Кола", am: "Կոլա" }, category: { en: "Drinks", ru: "Напитки", am: "Ըմպելիքներ" } },
  },
  {
    id: 21, branch_id: 1, name: "Սուրճ", category: null, price: 400, is_active: true, kind: "regular", stock: null,
    is_fast_food: false, partner_id: null, source_locale: "am",
    i18n: { name: { en: "Coffee", ru: "Кофе", am: "Սուրճ" } },
  },
];
/** What the Cola row reads in each language: the search never changes it. */
const COLA = { en: "Cola", ru: "Кола", am: "Կոլա" } as const;

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    test(`products: the search finds a product by any of its languages (${lang}, ${width})`, async ({ page }) => {
      await signIn(page, lang, width, "manager");
      await page.route(at("/products"), (r) => r.fulfill(json({ data: PRODUCTS })));
      await page.goto("/#/branches/1/products");
      await expect(page.getByTestId("product-row")).toHaveCount(2);

      const box = page.getByPlaceholder(t("products.search", lang));
      for (const word of ["cola", "КОЛА", "կոլա", "drinks", "напитки", "ԸՄՊԵԼԻՔ"]) {
        await box.fill(word);
        await expect(page.getByTestId("product-row"), `${lang}: «${word}»`).toHaveCount(1);
        await expect(page.getByTestId("product-row").locator(".name")).toHaveText(COLA[lang]);
      }
      await box.fill("pizza");
      await expect(page.getByTestId("product-row")).toHaveCount(0);
      await box.fill("");
      await expect(page.getByTestId("product-row")).toHaveCount(2);
    });
  }
}
