import { describe, expect, test } from "vitest";
import { t as translate } from "@/i18n/translations";
import {
  applyToOpenDays,
  bandOf,
  DayRow,
  readableSaveError,
  refusedFields,
  rowsFromBranch,
  spanOf,
  summaryOf,
} from "./openDaysModel";

const ru = (k: string) => translate(k, "ru");
const en = (k: string) => translate(k, "en");
const row = (start_time: string, end_time: string, open = true, day_of_week = 1): DayRow =>
  ({ day_of_week, open, start_time, end_time });

describe("spanOf / bandOf (WorkingWindow::forRow)", () => {
  test("a close at or before the open is next-day hours", () => {
    expect(spanOf(row("10:00", "23:00"))).toBe("sameDay");
    expect(spanOf(row("10:00", "00:00"))).toBe("toMidnight");
    expect(spanOf(row("10:00", "02:40"))).toBe("overnight");
    expect(spanOf(row("10:00", "10:00"))).toBe("fullDay");
    expect(spanOf(row("00:00", "00:00"))).toBe("allDay");
    expect(spanOf(row("10:0", "23:00"))).toBe("invalid");
  });

  test("the band covers this calendar day only", () => {
    expect(bandOf(row("10:00", "23:00"))).toEqual({ from: 600, to: 1380 });
    expect(bandOf(row("10:00", "02:40"))).toEqual({ from: 600, to: 1440 });
    expect(bandOf(row("00:00", "00:00"))).toEqual({ from: 0, to: 1440 });
    expect(bandOf(row("1", "23:00"))).toBeNull();
  });
});

describe("summaryOf", () => {
  const week = (r: (d: number) => DayRow) => [1, 2, 3, 4, 5, 6, 7].map(r);

  test("names the week in one line", () => {
    expect(summaryOf(week((d) => row("10:00", "23:00", true, d)), ru)).toBe("Каждый день · 10:00–23:00");
    expect(summaryOf(week((d) => row("10:00", "02:40", d !== 1, d)), ru)).toBe("Открыто 6 из 7 дней · 10:00–02:40 (+1 день)");
    expect(summaryOf(week((d) => row(d === 5 ? "12:00" : "10:00", "23:00", true, d)), ru)).toBe("Каждый день · разные часы");
    expect(summaryOf(week((d) => row("10:00", "23:00", false, d)), ru)).toBe("Все дни выходные");
    expect(summaryOf(week((d) => row("00:00", "00:00", true, d)), ru)).toBe("Круглосуточно, без выходных");
  });
});

describe("rowsFromBranch / applyToOpenDays", () => {
  test("a stored day keeps its trimmed times; an absent one is a day off with the defaults", () => {
    const rows = rowsFromBranch([{ day_of_week: 3, start_time: "08:15:00", end_time: "01:00:00" }]);
    expect(rows[2]).toEqual({ day_of_week: 3, open: true, start_time: "08:15", end_time: "01:00" });
    expect(rows[0]).toEqual({ day_of_week: 1, open: false, start_time: "10:00", end_time: "23:00" });
  });

  test("copies onto open days only", () => {
    const rows = [row("09:00", "21:00", true, 1), row("10:00", "23:00", false, 2), row("11:00", "22:00", true, 3)];
    expect(applyToOpenDays(rows, 1)).toEqual([
      row("09:00", "21:00", true, 1),
      row("10:00", "23:00", false, 2),
      row("09:00", "21:00", true, 3),
    ]);
  });
});

describe("the server's refusal", () => {
  const sent = [
    { day_of_week: 2, start_time: "10:00", end_time: "23:00" },
    { day_of_week: 6, start_time: "10:00", end_time: "23:00" },
  ];
  const refusal = (message: string, errors: Record<string, string[]> = {}) =>
    Object.assign(new Error(message), { status: 422, body: { message, errors } });

  test("names the field the way the form shows it, raw or with spaces", () => {
    expect(readableSaveError(refusal("Поле days_of_weeks.1.end_time не соответствует формату H:i. (and 13 more errors)"), sent, ru))
      .toBe("Поле «Сб, Закрытие» не соответствует формату H:i. (and 13 more errors)");
    expect(readableSaveError(refusal("The days of weeks.0.start time field must match the format H:i."), sent, en))
      .toBe('The "Tue, Open" field must match the format H:i.');
    expect(readableSaveError(refusal("Поле days_of_weeks должно содержать не менее 1 элемента."), sent, ru))
      .toBe("Поле «Часы работы» должно содержать не менее 1 элемента.");
  });

  test("no server sentence (offline, bare 5xx) is null", () => {
    expect(readableSaveError(new TypeError("Failed to fetch"), sent, en)).toBeNull();
    expect(readableSaveError(Object.assign(new Error("HTTP 502"), { status: 502, body: "<html>" }), sent, en)).toBeNull();
  });

  test("marks the refused time fields by weekday", () => {
    const e = refusal("x", { "days_of_weeks.1.start_time": ["x"], "days_of_weeks.0.end_time": ["x"], days_of_weeks: ["x"] });
    expect([...refusedFields(e, sent)].sort()).toEqual(["2:end", "6:start"]);
  });
});
