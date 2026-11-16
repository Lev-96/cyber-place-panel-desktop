import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * What the money/session features of 2026-11-15 actually SEND, against the
 * backend's own request rules (MakeUnlimitedRequest, AddTimeRequest,
 * SetReminderRequest, SessionController::store / addItem / updateItem).
 */
const sent = vi.hoisted(() => ({ calls: [] as Array<{ path: string; opts: { method?: string; body?: unknown } }> }));
vi.mock("./client", () => ({
  request: vi.fn(async (path: string, opts: { method?: string; body?: unknown } = {}) => {
    sent.calls.push({ path, opts });
    return { session: { id: 5 } };
  }),
}));

import * as api from "./sessions";

const last = () => sent.calls[sent.calls.length - 1];
afterEach(() => { sent.calls = []; });

describe("D: unlimited at the rate it bills now", () => {
  test("sends keep_rate and never a price", async () => {
    await api.apiMakeSessionUnlimited(5);
    expect(last()).toEqual({ path: "/sessions/5/unlimited", opts: { method: "POST", body: { keep_rate: true } } });
  });
});

describe("«Задать время»: in all from the start, or more from now (2026-11-15)", () => {
  test("the limit sends the minutes and where they count from", async () => {
    await api.apiLimitSession(5, 60, "start");
    expect(last()).toEqual({ path: "/sessions/5/limit", opts: { method: "POST", body: { minutes: 60, from: "start" } } });
    await api.apiLimitSession(5, 30, "now");
    expect(last().opts.body).toEqual({ minutes: 30, from: "now" });
  });
  test("the quote is a read of both choices for those minutes", async () => {
    await api.apiSessionLimitQuote(5, 60);
    expect(last()).toEqual({ path: "/sessions/5/limit-quote?minutes=60", opts: {} });
  });
});

describe("B: unpaid lines", () => {
  test("«Оплачено» sends unpaid:false on the line", async () => {
    await api.apiMarkSessionItemPaid(5, 9);
    expect(last()).toEqual({ path: "/sessions/5/items/9", opts: { method: "PATCH", body: { unpaid: false } } });
  });
});

describe("C: paid ahead", () => {
  test("+ Время paid now carries prepaid:true; without it the body is as before", async () => {
    await api.apiAddSessionTime(5, 30, undefined, undefined, true);
    expect(last().opts.body).toEqual({ minutes: 30, prepaid: true });
    await api.apiAddSessionTime(5, 30);
    expect(last().opts.body).toEqual({ minutes: 30 });
    await api.apiAddSessionTimeByAmount(5, 1000, undefined, true);
    expect(last().opts.body).toEqual({ amount: 1000, prepaid: true });
  });
});

describe("A: start by amount", () => {
  test("the quote asks for the sum (and own food when on)", async () => {
    await api.apiStartQuoteByAmount(3, 5000, false);
    expect(last().path).toBe("/sessions/start-quote?pc_id=3&amount=5000");
    await api.apiStartQuoteByAmount(3, 5000, true);
    expect(last().path).toBe("/sessions/start-quote?pc_id=3&amount=5000&outside_food=1");
  });
});

describe("E: reminders", () => {
  test("set: PUT minutes and the note; no note → no key", async () => {
    await api.apiSetSessionReminder(5, 120, "Арам");
    expect(last()).toEqual({ path: "/sessions/5/reminder", opts: { method: "PUT", body: { minutes: 120, note: "Арам" } } });
    await api.apiSetSessionReminder(5, 30);
    expect(last().opts.body).toEqual({ minutes: 30 });
  });
  test("clear: DELETE", async () => {
    await api.apiClearSessionReminder(5);
    expect(last()).toEqual({ path: "/sessions/5/reminder", opts: { method: "DELETE" } });
  });
});
