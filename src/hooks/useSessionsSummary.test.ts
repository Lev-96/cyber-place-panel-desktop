import { describe, expect, it } from "vitest";
import { ISessionApi } from "@/types/sessions";
import { aggregateSessionsSummary } from "./useSessionsSummary";

const make = (overrides: Partial<ISessionApi>): ISessionApi => ({
  id: 1,
  branch_id: 1,
  pc_id: 1,
  pc_label: "#1",
  started_at: "2026-05-01T10:00:00.000Z",
  ends_at: "2026-05-01T11:00:00.000Z",
  status: "stopped",
  total_paid: 0,
  items: [],
  ...overrides,
});

const summarize = (sessions: ISessionApi[]) => aggregateSessionsSummary(sessions);

describe("useSessionsSummary", () => {
  it("returns zeros for an empty list", () => {
    const s = summarize([]);
    expect(s.sessionsTotal).toBe(0);
    expect(s.stopped).toBe(0);
    expect(s.active).toBe(0);
    expect(s.total).toBe(0);
    expect(s.timeTotal).toBe(0);
    expect(s.itemsTotal).toBe(0);
    expect(s.itemsQty).toBe(0);
    expect(s.topItems).toEqual([]);
  });

  it("counts stopped vs active separately and only finalises money for closed sessions", () => {
    const s = summarize([
      make({ id: 1, status: "stopped", total_paid: 1500 }),
      make({ id: 2, status: "active", total_paid: 0 }),
      make({ id: 3, status: "expired", total_paid: 800 }),
    ]);
    expect(s.sessionsTotal).toBe(3);
    expect(s.stopped).toBe(2); // stopped + expired
    expect(s.active).toBe(1);
    // Active session's total_paid is not finalised → not added to total.
    expect(s.total).toBe(2300);
  });

  it("splits time vs items revenue using items_total derived from items", () => {
    const s = summarize([
      make({
        id: 1,
        status: "stopped",
        total_paid: 1500,
        items: [
          { id: 1, name: "Cola", price: 300, qty: 2, product_id: 1 },
          { id: 2, name: "Lays", price: 200, qty: 1, product_id: 2 },
        ],
      }),
    ]);
    expect(s.itemsTotal).toBe(800);
    expect(s.timeTotal).toBe(700); // 1500 - 800
    expect(s.itemsQty).toBe(3);
  });

  it("aggregates top items across sessions, ordered by total spend desc", () => {
    const s = summarize([
      make({
        id: 1,
        status: "stopped",
        total_paid: 600,
        items: [{ id: 1, name: "Cola", price: 300, qty: 2, product_id: 1 }],
      }),
      make({
        id: 2,
        status: "stopped",
        total_paid: 500,
        items: [
          { id: 2, name: "Cola", price: 300, qty: 1, product_id: 1 },
          { id: 3, name: "Lays", price: 200, qty: 1, product_id: 2 },
        ],
      }),
    ]);
    expect(s.topItems).toEqual([
      { name: "Cola", qty: 3, total: 900 },
      { name: "Lays", qty: 1, total: 200 },
    ]);
  });

  it("counts items revenue from active sessions but not their total_paid", () => {
    const s = summarize([
      make({
        id: 1,
        status: "active",
        total_paid: 0,
        items: [{ id: 1, name: "Cola", price: 300, qty: 2, product_id: 1 }],
      }),
    ]);
    // total stays 0 — active session money isn't finalised.
    expect(s.total).toBe(0);
    expect(s.timeTotal).toBe(0);
    // …but items already paid for inside the running session contribute.
    expect(s.itemsTotal).toBe(600);
    expect(s.itemsQty).toBe(2);
  });

  it("coerces stringy amounts safely (Laravel decimal:2 columns return strings)", () => {
    const s = summarize([
      make({
        id: 1,
        status: "stopped",
        total_paid: "1500.00" as unknown as number,
        items: [
          {
            id: 1,
            name: "Cola",
            price: "300.50" as unknown as number,
            qty: 2,
            product_id: 1,
          },
        ],
      }),
    ]);
    expect(s.itemsTotal).toBeCloseTo(601);
    expect(s.total).toBe(1500);
  });

  it("treats null / undefined items array as empty without throwing", () => {
    const s = summarize([
      make({ id: 1, status: "stopped", total_paid: 500, items: undefined }),
    ]);
    expect(s.itemsTotal).toBe(0);
    expect(s.itemsQty).toBe(0);
    expect(s.timeTotal).toBe(500);
  });

  it("clamps top items to 5 entries", () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      make({
        id: i + 1,
        status: "stopped",
        total_paid: (i + 1) * 100,
        items: [
          {
            id: i + 1,
            name: `Item${i}`,
            price: (i + 1) * 100,
            qty: 1,
            product_id: i + 1,
          },
        ],
      }),
    );
    const s = summarize(sessions);
    expect(s.topItems).toHaveLength(5);
    // Sorted descending by total — item9 has 1000, item8 has 900, …
    expect(s.topItems[0]).toEqual({ name: "Item9", qty: 1, total: 1000 });
    expect(s.topItems[4]).toEqual({ name: "Item5", qty: 1, total: 600 });
  });
});
