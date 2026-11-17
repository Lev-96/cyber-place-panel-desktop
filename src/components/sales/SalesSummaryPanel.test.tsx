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

const mount = async () => {
  await act(async () => { render(<SalesSummaryPanel branchId={1} from="2026-11-18" to="2026-11-18" />); });
  await act(async () => { await Promise.resolve(); });
};

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
