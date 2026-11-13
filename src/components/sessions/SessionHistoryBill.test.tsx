// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ISessionApi } from "@/types/sessions";
import SessionHistoryBill from "./SessionHistoryBill";

/**
 * The History card's bill as a table: one row per thing charged with its
 * quantity, price and sum, then the total and how it was paid. The figures are
 * the ones the row always computed — these pin both the layout and that no
 * number changed on the way.
 */

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    t: (k: string) => ({ "session.joystickSlot": "Pad #{0}", "session.perHourShort": "/h" } as Record<string, string>)[k] ?? k,
    money: (n: number) => `${n} AMD`,
  }),
}));

const pad = (slot: number, price: number, over: Record<string, unknown> = {}) =>
  ({ slot, price, is_charged: true, is_hourly: false, started_at: "2026-09-26T15:10:00+04:00", stopped_at: null, ...over });
const item = (id: number, name: string, qty: number, price: number, over: Record<string, unknown> = {}) =>
  ({ id, name, qty, price, product_id: id, ...over });

/** The session from the brief: 6 colas, water, cappuccino, one pad, 5 318 in total, cash. */
const session = (over: Record<string, unknown> = {}): ISessionApi => ({
  id: 9,
  status: "stopped",
  is_free: false,
  total_paid: 5318,
  payment_method: "cash",
  items: [item(1, "Cola 0.5L", 6, 600), item(2, "Bottled water", 1, 300), item(3, "Cappuccino", 1, 900)],
  joysticks: [pad(3, 500)],
  ...over,
} as unknown as ISessionApi);

const mount = (s: ISessionApi, closed = true) => render(<SessionHistoryBill session={s} closed={closed} />);
const cells = (tr: Element) => [...tr.children].map((c) => c.textContent);
const body = () => [...document.querySelectorAll("tbody tr")].map(cells);
const foot = () => [...document.querySelectorAll("tfoot tr")].map(cells);

afterEach(() => cleanup());

describe("SessionHistoryBill", () => {
  test("a table: item, qty, price, amount — one row per thing charged", () => {
    mount(session());
    expect(screen.getByRole("table")).toBeTruthy();
    expect(cells(document.querySelector("thead tr")!)).toEqual([
      "history.billItem", "history.billQty", "history.billPrice", "history.billSum",
    ]);
    expect(body()).toEqual([
      // The clock: the total less the products and the pads — 5318 − 4800 − 500.
      ["history.billTime", "-", "-", "18 AMD"],
      ["Cola 0.5L", "6", "600 AMD", "3600 AMD"],
      ["Bottled water", "1", "300 AMD", "300 AMD"],
      ["Cappuccino", "1", "900 AMD", "900 AMD"],
      ["history.itemsTotal", "4800 AMD"],
      ["Pad #3", "1", "500 AMD", "500 AMD"],
    ]);
    expect(foot()).toEqual([
      ["history.total", "5318 AMD"],
      ["session.payTitle", "session.payCash"],
    ]);
  });

  test("summary rows give their figure the two right-hand columns, so a bold total is never squeezed", () => {
    mount(session());
    const valueCells = [...document.querySelectorAll(".hs-bill__subtotal td, tfoot td")] as HTMLTableCellElement[];
    expect(valueCells).toHaveLength(3);
    expect(valueCells.every((c) => c.colSpan === 2)).toBe(true);
  });

  test("the rows add up to the total under them", () => {
    mount(session());
    const sums = [...document.querySelectorAll("tbody tr:not(.hs-bill__subtotal) td:last-child")]
      .map((c) => Number(c.textContent!.replace(" AMD", "")));
    expect(sums.reduce((a, b) => a + b, 0)).toBe(5318);
  });

  test("one product line needs no subtotal", () => {
    mount(session({ items: [item(1, "Cola 0.5L", 2, 600)], total_paid: 1718 }));
    expect(document.querySelector(".hs-bill__subtotal")).toBeNull();
  });

  test("several pads at one fee: their count, the fee each, the sum", () => {
    mount(session({ joysticks: [pad(3, 500), pad(4, 500)], total_paid: 5818 }));
    expect(body().at(-1)).toEqual(["Pad #3, 4", "2", "500 AMD", "1000 AMD"]);
  });

  test("an hourly pad marks its price as a rate; the sum is what it earned", () => {
    const hourly = pad(3, 500, { is_hourly: true, stopped_at: "2026-09-26T15:40:00+04:00" });
    mount(session({ joysticks: [hourly], total_paid: 5050 }));
    expect(body().at(-1)).toEqual(["Pad #3", "1", "500 AMD/h", "250 AMD"]);
  });

  test("pads that disagree on a price show no unit price, only the sum", () => {
    mount(session({ joysticks: [pad(3, 500), pad(4, 700)], total_paid: 6018 }));
    expect(body().at(-1)).toEqual(["Pad #3, 4", "2", "-", "1200 AMD"]);
  });

  test("an hourly extra shows its rate and the server's sum, not price × qty", () => {
    mount(session({ items: [item(7, "Cue", 1, 700, { is_hourly: true, line_total: 233.33 })], joysticks: [], total_paid: 1233.33 }));
    expect(body()).toContainEqual(["Cue", "1", "700 AMD/h", "233.33 AMD"]);
  });

  test("no products, no pads: the play time, the total and the payment", () => {
    mount(session({ items: [], joysticks: [], total_paid: 1003, payment_method: "card" }));
    expect(body()).toEqual([["history.billTime", "-", "-", "1003 AMD"]]);
    expect(foot()).toEqual([["history.total", "1003 AMD"], ["session.payTitle", "session.payCard"]]);
  });

  test("a cancelled session reads «Cancelled» alone, in red — no «· 0», never «free» (2026-11-06)", () => {
    mount(session({ is_free: true, total_paid: 0, cancelled_at: "2026-11-06T15:16:00+04:00" }));
    expect(foot()[0]).toEqual(["history.total", "history.billCancelled"]);
    const cell = document.querySelector("tfoot tr td") as HTMLElement;
    expect(cell.classList.contains("hs-bill__cancelled")).toBe(true);
  });

  test("a session never cancelled carries no red total", () => {
    mount(session({ is_free: true, total_paid: 0 }));
    expect(document.querySelector(".hs-bill__cancelled")).toBeNull();
  });

  test("a waived session reads as the words, with no pad row", () => {
    mount(session({ is_free: true, total_paid: 0 }));
    expect(foot()[0]).toEqual(["history.total", "session.freeBill"]);
    expect(body().some((r) => r[0]?.startsWith("Pad"))).toBe(false);
  });

  test("no payment recorded shows no payment row", () => {
    mount(session({ payment_method: null }));
    expect(foot()).toEqual([["history.total", "5318 AMD"]]);
  });

  test("a running session shows what is on the bill so far — no clock, no total", () => {
    mount(session({ status: "active" }), false);
    expect(body().map((r) => r[0])).toEqual(["Cola 0.5L", "Bottled water", "Cappuccino", "history.itemsTotal", "Pad #3"]);
    expect(document.querySelector("tfoot")).toBeNull();
  });

  test("a running session with nothing on the bill renders nothing", () => {
    mount(session({ status: "active", items: [], joysticks: [] }), false);
    expect(document.querySelector(".hs-bill")).toBeNull();
  });

  test("the table is labelled and its row headers name each line", () => {
    mount(session());
    expect(document.querySelector("section.hs-bill")?.getAttribute("aria-label")).toBe("history.billTitle");
    expect(document.querySelector("caption")?.textContent).toBe("history.billTitle");
    expect(document.querySelectorAll('tbody th[scope="row"]')).toHaveLength(6);
  });

  test("a counter reset says what it waived on its own line, and the total is the money taken (2026-11-05)", () => {
    mount(session({ total_paid: 550, time_waived_total: "400.00", items: [item(1, "Cola", 1, 300)], joysticks: [] }));
    const rows = body();
    expect(rows).toContainEqual(["history.billTime", "-", "-", "250 AMD"]);
    expect(rows).toContainEqual(["session.reset.waived", "−400 AMD"]);
    expect(foot()[0]).toEqual(["history.total", "550 AMD"]);
  });

  test("never reset: no such line", () => {
    mount(session());
    expect(document.querySelector('[data-testid="bill-waived"]')).toBeNull();
  });
});

describe("«Свои продукты» in the history bill (2026-11-13)", () => {
  test("its row is named by its kind, not by the starter's language; its sum is the line", () => {
    mount(session({
      total_paid: 2100,
      joysticks: [],
      items: [item(1, "Սեփական սնունդ", 1, 1500, { product_id: null, kind: "outside_food" }), item(2, "Cola 0.5L", 1, 600)],
    }));
    expect(body()).toEqual([
      ["history.billTime", "-", "-", "0 AMD"],
      ["session.outsideFood.line", "1", "1500 AMD", "1500 AMD"],
      ["Cola 0.5L", "1", "600 AMD", "600 AMD"],
      ["history.itemsTotal", "2100 AMD"],
    ]);
  });
});
