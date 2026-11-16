import { beforeAll, describe, expect, test } from "vitest";
import type { ISessionEvent } from "@/api/sessions";
import { t as translate, type Lang } from "@/i18n/translations";
import { eventPresentation } from "./sessionHistoryModel";

/**
 * The audit rows the backend writes since 2026-11-15 (paid ahead, «На сумму»,
 * unpaid lines, keep the rate, reminders), read through the REAL dictionary.
 * Meta shapes are the backend's own (SessionStartByAmountTest,
 * SessionPrepaidChangeTest, SessionItemUnpaidTest, SessionUnlimitedKeepRateTest,
 * SessionReminderTest): money as decimal strings, rate_now as numbers.
 */

beforeAll(() => { process.env.TZ = "Asia/Yerevan"; });

const money = (n: number) => `${n} AMD`;
const en = (k: string) => translate(k, "en");
const ru = (k: string) => translate(k, "ru");
const user = { id: 3, name: "Aram", role: "manager" };
const at = "2026-11-15T14:00:00Z"; // 18:00 in Yerevan

const row = (action: string, amount: number | null, meta: Record<string, unknown> | null, over: Partial<ISessionEvent> = {}): ISessionEvent => ({
  id: 1, session_id: 7, branch_id: 1, action, amount, meta, created_at: at, user, ...over,
} as ISessionEvent);

export const NEW_ROWS: ISessionEvent[] = [
  row("started", 5000, { mode: "fixed", is_free: false, planned_minutes: 300, hourly_rate: 1000, planned_amount: 5000,
    by_amount: true, paid_amount: "5000.00", time_amount: "5000.00", seconds: 18000, outside_food_fee: "0.00",
    standard_amount: 5000, prepaid_amount: "5000.00", prepaid_method: "cash" }),
  row("started", 2000, { mode: "fixed", is_free: false, planned_minutes: 120, hourly_rate: 1000, planned_amount: 2000,
    prepaid_amount: "2000.00", prepaid_method: "cash" }),
  row("time_added", 1000, { minutes: 60, new_ends_at: "2026-11-15T16:00:00Z", prepaid: true, prepaid_amount: "1000.00" }),
  row("item_added", 1800, { count: 2, unpaid_total: 1200, lines: [
    { name: "Cola", price: 600, qty: 1, extra: false, hourly: false, unpaid: false },
    { name: "Cola", price: 600, qty: 2, extra: false, hourly: false, unpaid: true },
  ] }),
  row("unpaid_off", 1200, { scope: "item", item: { id: 9, name: "Cola", qty: 2, price: 600, line_total: 1200 }, merged_into: 8, unpaid_items_left: 0 }),
  row("stopped", 1500, { payment_method: "cash", payments: [{ method: "cash", amount: "1500.00" }], prepaid_amount: "2000.00", change: "500.00", due: "0.00", cash_received: "2000.00" }),
  row("stopped", 2500, { payment_method: "card", payments: [{ method: "cash", amount: "2000.00" }, { method: "card", amount: "500.00" }], prepaid_amount: "2000.00", change: "0.00", due: "500.00", cash_received: "2000.00" }),
  row("stopped", 2000, { payment_method: "cash", payments: [{ method: "cash", amount: "2000.00" }], prepaid_amount: "2000.00", change: "0.00", due: "0.00", cash_received: "2000.00" }),
  row("stopped", 3000, { payment_method: "cash", payments: [{ method: "cash", amount: "3000.00" }], cash_received: "5000.00", unpaid_amount: "1200.00" }),
  row("payment_recorded", 2500, { payments: [{ method: "cash", amount: "2500.00" }], after: "expired", prepaid_amount: "2000.00", change: "0.00", due: "500.00", cash_received: "2500.00" }),
  row("cancelled", 1600, { time_cost: 1000, items_total: 600, joysticks_total: 0, prepaid_amount: "2000.00", change: "2000.00" }),
  row("made_unlimited", null, { old_mode: "fixed", hourly_rate: 1000, rate_source: "kept", rate_before: 1000, rate_now: { seat: 1000, pads: 500, extras: 0, total: 1500 } }),
  row("made_unlimited", null, { old_mode: "fixed", hourly_rate: 1200, rate_source: "typed", rate_before: 1000, rate_now: { seat: 1200, pads: 0, extras: 0, total: 1200 } }),
  row("limited", 1500, { minutes: 60, rate_source: "current", rate_now: { seat: 1000, pads: 500, extras: 300, total: 1800 } }),
  row("reminder_set", null, { minutes: 120, remind_at: "2026-11-15T16:00:00Z", note: "Арам", previous_remind_at: null, previous_minutes: null, previous_note: null, previous_fired_at: null }),
  row("reminder_set", null, { minutes: 30, remind_at: "2026-11-15T14:30:00Z", note: null, previous_remind_at: "2026-11-15T16:00:00Z", previous_minutes: 120, previous_note: "Арам", previous_fired_at: null }),
  row("reminder_cleared", null, { fired: true, remind_at: "2026-11-15T16:00:00Z", minutes: 120, note: "Арам" }),
  row("reminder_fired", null, { notified: 3, remind_at: "2026-11-15T16:00:00Z", minutes: 120, note: "Арам", set_by_user_id: 3 }, { user: null }),
  // «Задать время» counted in all from the start / more from now (2026-11-15,
  // SessionLimitTest): seat #258's shape, ten seconds played at 1000/h.
  row("limited", 997.22, { minutes: 60, hourly_rate: 1000, from: "start", played_seconds: 10, time_total: 1000,
    new_ends_at: "2026-11-15T15:15:37Z", rate_source: "current", rate_now: { seat: 1000, pads: 500, extras: 0, total: 1500 } }),
  row("limited", 1000, { minutes: 60, hourly_rate: 1000, from: "now", played_seconds: 10, time_total: 1002.78,
    new_ends_at: "2026-11-15T15:15:47Z", rate_source: "current", rate_now: { seat: 1000, pads: 0, extras: 0, total: 1000 } }),
];

const pres = (i: number, t = en) => eventPresentation(NEW_ROWS[i], t, money);

describe("an action this build does not know (the fallback)", () => {
  test("with the REAL dictionary it reads as words, never as the raw key", () => {
    const p = eventPresentation(row("brand_new_thing", null, { note: "x" }), en, money);
    expect(p.title).toBe("Brand new thing");
    expect(p.title).not.toContain("history.action");
  });
});

describe("«На сумму» and paid ahead at the start", () => {
  test("by amount: the sum, what it bought, the plan and the rate", () => {
    const d = pres(0).details;
    expect(d[0]).toBe("By amount 5000 AMD → 5 h");
    expect(d).toContain("1000 AMD / h");
    expect(d.join(" | ")).not.toContain("Paid ahead"); // the sum IS the prepayment
  });
  test("a package / planned length paid ahead says so", () => {
    expect(pres(1).details).toContain("Paid ahead in cash: 2000 AMD");
    expect(pres(1, ru).details).toContain("Оплачено вперёд наличными: 2000 AMD");
  });
  test("+ Время paid at the counter", () => {
    expect(pres(2).details).toContain("Paid now in cash: 1000 AMD");
  });
});

describe("unpaid lines", () => {
  test("a sale names the unpaid line and what is not paid yet", () => {
    const d = pres(3).details;
    expect(d).toContain("Cola × 1");
    expect(d).toContain("Cola × 2 · not paid");
    expect(d).toContain("Not paid yet: 1200 AMD");
  });
  test("an unpaid line marked paid is its own title, with the line", () => {
    const p = pres(4);
    expect(p.title).toBe("Marked as paid");
    expect(p.details).toEqual(["Cola × 2 · 1200 AMD"]);
    expect(pres(4, ru).title).toBe("Отметил оплату товара");
  });
  test("a plain unpaid_off (extra time) keeps its old title", () => {
    expect(eventPresentation(row("unpaid_off", null, null), en, money).title).toBe("Cleared the unpaid mark");
  });
});

describe("change and due at the end", () => {
  test("paid ahead with change", () => {
    expect(pres(5).details).toContain("Paid ahead 2000 AMD · Change 500 AMD");
    expect(pres(5, ru).details).toContain("Предоплата 2000 AMD · Сдача 500 AMD");
  });
  test("paid ahead with something due", () => {
    expect(pres(6).details).toContain("Paid ahead 2000 AMD · Due 500 AMD");
  });
  test("paid ahead exactly", () => {
    expect(pres(7).details).toContain("Paid ahead 2000 AMD · No change");
  });
  test("a cash stop says what was handed over, and what was left unpaid", () => {
    const d = pres(8).details;
    expect(d).toContain("Cash received: 5000 AMD");
    expect(d).toContain("Not paid at the end: 1200 AMD");
  });
  test("after-the-fact payment on a prepaid seat", () => {
    expect(pres(9).details).toContain("Paid ahead 2000 AMD · Due 500 AMD");
  });
  test("a cancel hands the prepayment back", () => {
    expect(pres(10).details).toContain("Paid ahead returned in full: 2000 AMD");
  });
});

describe("unlimited / limited with the rate now", () => {
  test("kept: the price in all, and its parts", () => {
    const d = pres(11).details;
    expect(d).toContain("Price kept: 1500 AMD/h (seat 1000 AMD + joysticks 500 AMD)");
    expect(d).not.toContain("1000 AMD / h");
    expect(pres(11, ru).details).toContain("Цена прежняя: 1500 AMD/ч (место 1000 AMD + джойстики 500 AMD)");
  });
  test("typed: the old line, unchanged when nothing else bills by the hour", () => {
    expect(pres(12).details).toEqual(["fixed -> Unlimited", "1200 AMD / h"]);
  });
  test("limited: what an hour costs now", () => {
    expect(pres(13).details).toContain("Per hour now: 1800 AMD/h (seat 1000 AMD + joysticks 500 AMD + rentals 300 AMD)");
  });
  test("limited before `from` existed: no anchor, no total, exactly as before", () => {
    expect(pres(13).details.join(" | ")).not.toMatch(/In all|more from now|Seat time/);
  });
  test("limited in all from the start: the end and the seat's time in all", () => {
    const d = pres(18).details;
    expect(d[0]).toBe("In all from the start, until 19:15");
    expect(d[1]).toBe("Seat time in all: 1000 AMD");
    expect(d).toContain("Per hour now: 1500 AMD/h (seat 1000 AMD + joysticks 500 AMD)");
    expect(pres(18, ru).details.slice(0, 2)).toEqual(["Всего с начала места, до 19:15", "Время места всего: 1000 AMD"]);
  });
  test("limited more from now: the length added, the end and the seat's time in all", () => {
    const d = pres(19).details;
    expect(d[0]).toBe("1 h more from now, until 19:15");
    expect(d[1]).toBe("Seat time in all: 1002.78 AMD");
    expect(pres(19, ru).details[0]).toBe("Ещё 1 ч от сейчас, до 19:15");
  });
});

describe("reminders", () => {
  test("set: in how long, at what time, and the note", () => {
    const p = pres(14);
    expect(p.title).toBe("Set a reminder");
    expect(p.details).toEqual(["in 2 h", "at 20:00", "«Арам»"]);
  });
  test("changed: its own title and what it was", () => {
    const p = pres(15);
    expect(p.title).toBe("Changed the reminder");
    expect(p.details).toEqual(["in 30 min", "at 18:30", "was 20:00"]);
  });
  test("cleared after it rang", () => {
    const p = pres(16);
    expect(p.title).toBe("Removed the reminder");
    expect(p.details).toEqual(["was 20:00", "after it rang"]);
  });
  test("rang: by the system, how many people were told", () => {
    const p = pres(17);
    expect(p.title).toBe("The reminder rang");
    expect(p.actor).toBe("Automatically");
    expect(p.details).toEqual(["«Арам»", "Told: 3"]);
  });
});

describe("no raw key and no em dash anywhere, in every language", () => {
  for (const lang of ["en", "ru", "am"] as Lang[]) {
    test(lang, () => {
      const t = (k: string) => translate(k, lang);
      for (const e of NEW_ROWS) {
        const p = eventPresentation(e, t, money);
        const text = [p.title, ...p.details].join(" | ");
        expect(text, e.action).not.toMatch(/history\.|session\.|time\./);
        expect(text).not.toContain("—");
      }
    });
  }
});
