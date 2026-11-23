import { describe, expect, test } from "vitest";
import { ISessionApi } from "@/types/sessions";
import { sessionAmountAt } from "./sessionAmount";

/**
 * A product is added at its price; the step rounds the seat only (2026-11-24,
 * owner). The card shows what the receipt will say: the same hand-worked
 * figures as the backend's SessionProductsAtTheirPriceTest.
 *
 * The seat: 1 000/h, 37 minutes = 616.666…; a cola at 250.
 */
const T0 = Date.parse("2026-11-24T08:00:00.000Z");
const at = (min: number) => T0 + min * 60_000;
const iso = (min: number) => new Date(at(min)).toISOString();

const seatWithCola = (over: Partial<ISessionApi> = {}): ISessionApi => ({
  id: 7, status: "active", mode: "open", started_at: iso(0), ends_at: null, committed_until: null,
  hourly_rate: 1000, time_package: null, time_package_id: null, total_paid: 0, is_free: false,
  rounding_step: 100, rounding_mode: "up", rounding_covers_products: false,
  items: [{ id: 1, name: "Coca-Cola", price: 250, qty: 1, is_hourly: false, line_total: 250 }],
  ...over,
} as ISessionApi);

describe("the card under the current rule: the seat is rounded, the cola is 250", () => {
  test("step 100 up: 616.67 → 700, + 250 = 950 (it was 900)", () => {
    expect(sessionAmountAt(seatWithCola(), at(37))).toBe(950);
  });

  test("step 10 to the nearest: 616.67 → 620, + 250 = 870", () => {
    expect(sessionAmountAt(seatWithCola({ rounding_step: 10, rounding_mode: "nearest" }), at(37))).toBe(870);
  });

  test("a line billed by the hour rounds with the seat: 616.67 + 431.67 → 1100, + 250 = 1350", () => {
    const s = seatWithCola({
      items: [
        { id: 1, name: "Coca-Cola", price: 250, qty: 1, is_hourly: false, line_total: 250 },
        { id: 2, name: "Cue", price: 700, qty: 1, is_hourly: true, created_at: iso(0), returned_at: null, line_total: 0 },
      ] as ISessionApi["items"],
    });
    expect(sessionAmountAt(s, at(37))).toBe(1350);
  });

  test("no step: nothing moves, 866.67", () => {
    expect(sessionAmountAt(seatWithCola({ rounding_step: 0 }), at(37))).toBe(866.67);
  });

  test("a free seat is 0", () => {
    expect(sessionAmountAt(seatWithCola({ is_free: true }), at(37))).toBe(0);
  });
});

describe("a bill banked before it, or an older backend: the step covers everything", () => {
  test("rounding_covers_products true: 866.67 → 900", () => {
    expect(sessionAmountAt(seatWithCola({ rounding_covers_products: true }), at(37))).toBe(900);
  });

  test("the flag absent: as that backend counts, 900", () => {
    const s = seatWithCola();
    delete (s as Partial<ISessionApi>).rounding_covers_products;
    expect(sessionAmountAt(s, at(37))).toBe(900);
  });
});
