import { describe, expect, test } from "vitest";
import { t as translate } from "@/i18n/translations";
import { hoursLine } from "./salesSummaryModel";

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
