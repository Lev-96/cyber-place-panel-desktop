// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ISalesSummary } from "@/api/salesSummary";

/**
 * «История продаж» in figures (2026-11-18): every figure as the server sent it,
 * nothing added up here; each card opens its own records.
 */
const api = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@/api/salesSummary", () => ({ apiSalesSummary: (...a: unknown[]) => api.fn(...a) }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "ru"), money: (n: number) => `${n} ֏`, lang: "ru" }) };
});
vi.mock("@/components/ui/Modal", () => ({ default: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div> }));

import SalesSummaryPanel from "./SalesSummaryPanel";

const summary = (over: Partial<ISalesSummary> = {}): { data: ISalesSummary } => ({
  data: {
    branch_id: 1,
    window: { date_from: "2026-11-18", date_to: "2026-11-18", from: "", to: "", business_day: { start: "13:00", end: "07:00" }, is_today: true },
    totals: { grand_total: "12000.00", places_total: "9000.00", places_count: 6, places_free_count: 0, till_total: "3000.00", till_count: 2, products_total: "4500.00", products_units: 9 },
    by_method: [
      { method: "cash", label: null, amount: "5000.00", count: 4 },
      { method: "card", label: null, amount: "4000.00", count: 2 },
      { method: "other", label: "Hovo Card", amount: "3000.00", count: 1 },
      { method: "other", label: null, amount: "0.00", count: 0 },
    ],
    drawer: { net_cash: "5000.00" },
    lines: [],
    lines_meta: { current_page: 1, last_page: 1, per_page: 1, total: 8 },
    ...over,
  },
});

const mount = async (placeId?: number | null) => {
  await act(async () => { render(<SalesSummaryPanel branchId={1} from="2026-11-18" to="2026-11-18" placeId={placeId} />); });
  await act(async () => { await Promise.resolve(); });
};

/** The 2026-11-18 additions: fast food inside the totals, what the products are, the place echo. */
const withFastFood = (over: Partial<ISalesSummary> = {}) => {
  const base = summary().data;
  return summary({
    totals: { ...base.totals, fast_food_total: "3500.00", fast_food_units: 3 },
    products_rows: [
      { product_id: 2, name: "Burger", unit_price: "1500.00", quantity: 2, total: "3000.00", is_fast_food: true, partner_id: 7 },
      { product_id: 1, name: "Cola", unit_price: "500.00", quantity: 1, total: "500.00", is_fast_food: false, partner_id: null },
      { product_id: 3, name: "Hot dog", unit_price: "500.00", quantity: 1, total: "500.00", is_fast_food: true, partner_id: null },
    ],
    ...over,
  });
};
const rowsIn = (dialog: HTMLElement) =>
  [...dialog.querySelectorAll("[data-testid=sales-product-row]")].map((r) => [...r.children].map((c) => c.textContent));

beforeEach(() => api.fn.mockReset());
afterEach(cleanup);

describe("SalesSummaryPanel", () => {
  test("says which day and which hours, then the server's figures as sent", async () => {
    api.fn.mockResolvedValue(summary());
    await mount();
    expect(api.fn).toHaveBeenCalledWith(1, { date_from: "2026-11-18", date_to: "2026-11-18", per_page: 1 });
    expect(screen.getByTestId("sales-period").textContent).toBe("Сегодня, 18.11.2026");
    expect(screen.getByTestId("sales-hours").textContent).toBe("Расчёт с 13:00 до 07:00 (время работы)");
    expect(screen.getByTestId("sales-grand").textContent).toContain("Итог общей продажи");
    expect(screen.getByTestId("sales-grand").textContent).toContain("12000 ֏");
    expect(screen.getByTestId("sales-places").textContent).toContain("9000 ֏");
    expect(screen.getByTestId("sales-places").textContent).toContain("Закрытых мест: 6");
    expect(screen.getByTestId("sales-till").textContent).toContain("3000 ֏");
    expect(screen.getByTestId("sales-products").textContent).toContain("Штук: 9");
  });

  test("each way of paying: its sum and how many times; a named own option by its name; an empty «Другое» left out", async () => {
    api.fn.mockResolvedValue(summary());
    await mount();
    expect(screen.getByTestId("sales-method-cash").textContent).toBe("Наличные5000 ֏Платежей: 4");
    expect(screen.getByTestId("sales-method-card").textContent).toBe("Банковская карта4000 ֏Платежей: 2");
    expect(screen.getByTestId("sales-method-other-Hovo Card").textContent).toBe("Hovo Card3000 ֏Платежей: 1");
    expect(screen.queryByTestId("sales-method-other")).toBeNull();
    // Drawer equals cash payments: no extra line.
    expect(screen.queryByTestId("sales-drawer")).toBeNull();
  });

  test("another day: its date, no «Сегодня»; a range in words; a branch without hours counts the calendar day", async () => {
    const w = summary().data.window;
    api.fn.mockResolvedValue(summary({ window: { ...w, is_today: false, date_from: "2026-11-01", date_to: "2026-11-18", business_day: null } }));
    await mount();
    expect(screen.getByTestId("sales-period").textContent).toBe("С 01.11.2026 по 18.11.2026");
    expect(screen.getByTestId("sales-hours").textContent).toContain("календарному дню");
  });

  test("a card opens its records: day, time, where, who, how paid", async () => {
    api.fn.mockResolvedValueOnce(summary());
    await mount();
    api.fn.mockResolvedValueOnce(summary({
      lines: [{
        kind: "till", id: 4, at: "2026-11-18T14:05:00+04:00", seat: null, staff: { id: 3, name: "Анна" }, is_free: false,
        method: "split", payments: [{ method: "cash", amount: "1000.00" }, { method: "other", amount: "3000.00", label: "Hovo Card" }], amount: "4000.00",
      }],
      lines_meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 },
    }));
    await act(async () => { fireEvent.click(screen.getByTestId("sales-method-other-Hovo Card")); });
    await act(async () => { await Promise.resolve(); });
    expect(api.fn).toHaveBeenLastCalledWith(1, { date_from: "2026-11-18", date_to: "2026-11-18", per_page: 100, page: 1, method: "other", label: "Hovo Card" });
    const line = screen.getByTestId("sales-line-till-4");
    expect(line.textContent).toContain("Товары без места");
    expect(line.textContent).toContain("18.11.2026 14:05");
    expect(line.textContent).toContain("Анна");
    expect(line.textContent).toContain("Наличные 1000 ֏ · Hovo Card 3000 ֏");
    expect(line.textContent).toContain("4000 ֏");
  });

  test("the places card asks for places only", async () => {
    api.fn.mockResolvedValue(summary());
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("sales-places")); });
    expect(api.fn).toHaveBeenLastCalledWith(1, expect.objectContaining({ kind: "place", page: 1 }));
  });
});

describe("SalesSummaryPanel — «Быстрая Еда», products, comments, one place (2026-11-18)", () => {
  test("the fast-food card: the server's sum, «Штук: N», already in the total", async () => {
    api.fn.mockResolvedValue(withFastFood());
    await mount();
    const card = screen.getByTestId("sales-fast-food");
    expect(card.textContent).toBe("Быстрая Еда3500 ֏Штук: 3уже входит в итог");
    // A part of the totals, never added to them: the grand total is as sent.
    expect(screen.getByTestId("sales-grand").textContent).toContain("12000 ֏");
  });

  test("an older backend without the keys: no fast-food card, and the products card opens nothing", async () => {
    api.fn.mockResolvedValue(summary());
    await mount();
    expect(screen.queryByTestId("sales-fast-food")).toBeNull();
    expect(screen.getByTestId("sales-products").tagName).toBe("DIV");
  });

  test("«Общая сумма товаров» opens every product row as sent: name, price, quantity, sum", async () => {
    api.fn.mockResolvedValue(withFastFood());
    await mount();
    const calls = api.fn.mock.calls.length;
    await act(async () => { fireEvent.click(screen.getByTestId("sales-products")); });
    const dialog = screen.getByTestId("sales-products-dialog");
    expect(rowsIn(dialog)).toEqual([
      ["Burger", "1500 ֏", "× 2", "3000 ֏"],
      ["Cola", "500 ֏", "× 1", "500 ֏"],
      ["Hot dog", "500 ֏", "× 1", "500 ֏"],
    ]);
    // Already in the summary: nothing more is asked.
    expect(api.fn.mock.calls.length).toBe(calls);
  });

  test("the fast-food card opens the fast-food rows only", async () => {
    api.fn.mockResolvedValue(withFastFood());
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("sales-fast-food")); });
    const dialog = screen.getByTestId("sales-products-dialog");
    expect(dialog.textContent).toContain("Быстрая Еда");
    expect(rowsIn(dialog).map((r) => r[0])).toEqual(["Burger", "Hot dog"]);
  });

  test("a record with a comment says «Комментарий: …»; one without says nothing", async () => {
    api.fn.mockResolvedValueOnce(withFastFood());
    await mount();
    api.fn.mockResolvedValueOnce(summary({
      lines: [
        { kind: "till", id: 4, at: "2026-11-18T14:05:00+04:00", seat: null, staff: null, is_free: false, method: "cash", payments: [{ method: "cash", amount: "500.00" }], amount: "500.00", note: "за Арама" },
        { kind: "till", id: 5, at: "2026-11-18T14:06:00+04:00", seat: null, staff: null, is_free: false, method: "cash", payments: [{ method: "cash", amount: "500.00" }], amount: "500.00", note: null },
      ],
      lines_meta: { current_page: 1, last_page: 1, per_page: 100, total: 2 },
    }));
    await act(async () => { fireEvent.click(screen.getByTestId("sales-till")); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("sales-line-till-4").textContent).toContain("Комментарий: за Арама");
    expect(screen.getByTestId("sales-line-till-5").querySelector("[data-testid=sales-line-note]")).toBeNull();
  });

  test("a picked place: place_id on the figures and on a card's records; sales without a place are said to be left out", async () => {
    const base = withFastFood().data;
    api.fn.mockResolvedValue(withFastFood({ window: { ...base.window, place_id: 30, till_included: false } }));
    await mount(30);
    expect(api.fn).toHaveBeenCalledWith(1, { date_from: "2026-11-18", date_to: "2026-11-18", per_page: 1, place_id: 30 });
    expect(screen.queryByTestId("sales-till")).toBeNull();
    expect(screen.getByTestId("sales-no-till").textContent).toBe("Без продаж товаров без места");
    expect(screen.getByTestId("sales-grand").textContent).toContain("Только это место");
    await act(async () => { fireEvent.click(screen.getByTestId("sales-places")); });
    expect(api.fn).toHaveBeenLastCalledWith(1, expect.objectContaining({ kind: "place", place_id: 30, page: 1 }));
  });

  test("without a place, no request carries a place_id key", async () => {
    api.fn.mockResolvedValue(withFastFood());
    await mount(null);
    await act(async () => { fireEvent.click(screen.getByTestId("sales-grand")); });
    for (const call of api.fn.mock.calls) expect(call[1]).not.toHaveProperty("place_id");
    expect(screen.queryByTestId("sales-no-till")).toBeNull();
  });

  test("a club that sold no fast food gets no «Быстрая Еда» card (2026-11-18)", async () => {
    const base = summary().data;
    api.fn.mockResolvedValue({ data: { ...base, totals: { ...base.totals, fast_food_total: "0.00", fast_food_units: 0 } } });
    await mount();
    expect(screen.getByTestId("sales-grand")).toBeTruthy();
    expect(screen.queryByText("Быстрая Еда")).toBeNull();
  });

  test("«Другое (без названия)» asks for the nameless parts only (2026-11-18)", async () => {
    const base = summary().data;
    api.fn.mockResolvedValue({ data: { ...base, by_method: [...base.by_method.filter((r) => r.label !== null || r.method !== "other"), { method: "other", label: null, amount: "50.00", count: 1 }] } });
    await mount();
    await act(async () => { fireEvent.click(screen.getByTestId("sales-method-other")); });
    expect(api.fn).toHaveBeenLastCalledWith(1, expect.objectContaining({ method: "other", unnamed: 1 }));
    expect(api.fn.mock.lastCall?.[1]).not.toHaveProperty("label");
  });
});

