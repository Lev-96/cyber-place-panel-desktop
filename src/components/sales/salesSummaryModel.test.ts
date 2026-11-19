import { describe, expect, test } from "vitest";
import { t as translate } from "@/i18n/translations";
import { hoursLine, lineAmount, partsLine, whereLine } from "./salesSummaryModel";
import type { ISalesLine } from "@/api/salesSummary";

const t = (k: string) => translate(k, "ru");
const win = (over: Record<string, unknown>) => ({
  date_from: "2026-11-18", date_to: "2026-11-18", from: "", to: "", business_day: { start: "13:00", end: "07:00" }, is_today: true, ...over,
}) as never;

/** «Расчёт: с … до …» with the days themselves (2026-11-18, owner). */
describe("hoursLine", () => {
  test("a club open past midnight closes the NEXT morning", () => {
    expect(hoursLine(win({}), t)).toBe("Расчёт: с 13:00 18.11.2026 до 07:00 19.11.2026 (время работы)");
  });
  test("a club that closes before midnight closes the same day", () => {
    expect(hoursLine(win({ business_day: { start: "10:00", end: "22:00" } }), t)).toBe("Расчёт: с 10:00 18.11.2026 до 22:00 18.11.2026 (время работы)");
  });
  test("a range: from the first day's opening to the last day's closing", () => {
    expect(hoursLine(win({ date_from: "2026-11-01", date_to: "2026-11-30" }), t)).toBe("Расчёт: с 13:00 01.11.2026 до 07:00 01.12.2026 (время работы)");
  });
  test("no published hours: the calendar day", () => {
    expect(hoursLine(win({ business_day: null }), t)).toContain("календарному дню");
  });
});

/** Paid ahead, counted when taken (2026-11-20): how its records read. */
describe("a seat paid ahead in the records", () => {
  const ru = (k: string) => translate(k, "ru");
  const money = (n: number) => `${n} драм`;
  const line = (over: Partial<ISalesLine>): ISalesLine => ({
    kind: "place", id: 1, at: null, seat: "№4", is_free: false, method: "cash", payments: [], amount: "0.00", ...over,
  } as ISalesLine);

  test("the sum paid ahead names the seat and how it was paid", () => {
    const l = line({ kind: "prepaid", payments: [{ method: "card", amount: "2000.00" }] as never, amount: "2000.00", bill: null });
    expect(whereLine(l, ru)).toBe("№4 · оплачено заранее");
    expect(partsLine(l, money, ru)).toBe("Банковская карта 2000 драм");
    expect(lineAmount(l)).toBe(2000);
  });

  test("the close shows the whole bill; the due, or the change / refund", () => {
    const due = line({ payments: [{ method: "cash", amount: "500.00" }] as never, amount: "500.00", bill: "2500.00", prepaid: "2000.00" });
    expect(lineAmount(due)).toBe(2500);
    expect(partsLine(due, money, ru)).toBe("Наличные 500 драм");
    const back = line({ payments: [{ method: "card", amount: "-500.00" }] as never, amount: "-500.00", bill: "1500.00", prepaid: "2000.00" });
    expect(lineAmount(back)).toBe(1500);
    expect(partsLine(back, money, ru)).toBe("Сдача / возврат: Банковская карта 500 драм");
    const exact = line({ payments: [], amount: "0.00", bill: "2000.00", prepaid: "2000.00" });
    expect(partsLine(exact, money, ru)).toBe("Оплачено заранее, без доплаты");
  });

  test("a seat not paid ahead, and an older backend with no bill, read as before", () => {
    const plain = line({ payments: [{ method: "cash", amount: "1000.00" }] as never, amount: "1000.00" });
    expect(lineAmount(plain)).toBe(1000);
    expect(partsLine(plain, money, ru)).toBe("Наличные 1000 драм");
    expect(partsLine(line({ payments: [] }), money, ru)).toBe("Способ оплаты не отмечен");
  });
});
