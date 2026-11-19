// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The Products screen's search (2026-11-20, owner): «не важно на каком языке
 * десктоп, всё равно должен понимать фильтр». A product is typed once and the
 * backend fills every other locale into its `i18n` bag; the search finds it by
 * any of those words — what was typed and each translation, name or category,
 * any letter case, Latin, Cyrillic or Armenian — whatever the panel's
 * language. The same word gives the same rows in en, ru and am.
 */

const repo = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/repositories/ProductRepository", () => ({
  productRepository: { listWithStock: (...a: unknown[]) => repo.list(...a), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/repositories/BranchRepository", () => ({ branchRepository: { byId: vi.fn() } }));
vi.mock("@/repositories/PartnerRepository", () => ({ partnerRepository: { list: vi.fn() } }));
vi.mock("@/components/products/ProductForm", () => ({ default: () => null }));
vi.mock("@/components/products/ProductStockDialog", () => ({ default: () => null }));
const ui = vi.hoisted(() => ({ lang: "en" as "en" | "ru" | "am" }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: (n: number) => `${n}`, lang: ui.lang }) }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "manager" } }) }));
vi.mock("@/repositories/ProductEventRepository", () => ({ productEventRepository: { available: async () => false } }));
vi.mock("@/components/products/ProductHistory", () => ({ default: () => null }));
vi.mock("@/components/ui/ConfirmProvider", () => ({ useConfirm: () => async () => true }));

import ProductsList from "./ProductsList";

const PRODUCTS = [
  // Typed in Russian, translated by the backend into the other two.
  {
    id: 1, branch_id: 3, name: "Кола", category: "Напитки", price: 500, is_active: true, kind: "regular", source_locale: "ru",
    i18n: { name: { en: "Cola", ru: "Кола", am: "Կոլա" }, category: { en: "Drinks", ru: "Напитки", am: "Ըմպելիքներ" } },
  },
  // Typed in Armenian, the Russian translation still being produced.
  {
    id: 2, branch_id: 3, name: "Սուրճ", category: null, price: 400, is_active: true, kind: "regular", source_locale: "am",
    i18n: { name: { en: "Coffee", ru: null, am: "Սուրճ" } },
  },
  // An older backend: no bag at all, the name as typed.
  { id: 3, branch_id: 3, name: "Snickers", category: "Сладкое", price: 300, is_active: true, kind: "regular" },
];

const mount = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/branches/3/products"]}>
        <Routes><Route path="/branches/:branchId/products" element={<ProductsList />} /></Routes>
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve(); });
};
const search = async (text: string) => {
  await act(async () => { fireEvent.change(screen.getByPlaceholderText("products.search"), { target: { value: text } }); });
};
const ids = () => screen.queryAllByTestId("product-row").map((r) => r.querySelector(".name")?.textContent);

/** What each row shows in a language (the search never changes that). */
const SHOWN = {
  en: { cola: "Cola", coffee: "Coffee", snickers: "Snickers" },
  ru: { cola: "Кола", coffee: "Coffee", snickers: "Snickers" },
  am: { cola: "Կոլա", coffee: "Սուրճ", snickers: "Snickers" },
} as const;

/** Every word of a product, in every script and case, and what it must find. */
const CASES: [string, keyof typeof SHOWN.en][] = [
  ["cola", "cola"], ["COLA", "cola"], ["кола", "cola"], ["КОЛА", "cola"], ["կոլա", "cola"], ["ԿՈԼԱ", "cola"],
  ["drinks", "cola"], ["напитки", "cola"], ["Ըմպելիք", "cola"],
  ["coffee", "coffee"], ["սուրճ", "coffee"], ["ՍՈՒՐՃ", "coffee"],
  ["snick", "snickers"], ["сладк", "snickers"],
];

beforeEach(() => {
  repo.list.mockReset();
  repo.list.mockResolvedValue({ products: PRODUCTS, stock: null });
});
afterEach(() => cleanup());

describe("ProductsList — the search understands every language", () => {
  for (const lang of ["en", "ru", "am"] as const) {
    test(`panel in ${lang}: any product word, in any script and case, finds the product`, async () => {
      ui.lang = lang;
      await mount();
      for (const [needle, product] of CASES) {
        await search(needle);
        expect(ids(), `${lang}: «${needle}»`).toEqual([SHOWN[lang][product]]);
      }
    });

    test(`panel in ${lang}: a word no product has finds nothing, and clearing shows them all`, async () => {
      ui.lang = lang;
      await mount();
      await search("pizza");
      expect(ids()).toEqual([]);
      await search("  ");
      expect(ids()).toEqual([SHOWN[lang].cola, SHOWN[lang].coffee, SHOWN[lang].snickers]);
    });
  }
});
