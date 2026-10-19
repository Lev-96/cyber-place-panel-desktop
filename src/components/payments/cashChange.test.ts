import { describe, expect, test } from "vitest";
import { billCents, cashChange } from "./cashChange";

/** The change table from the spec, in cents so no float touches it. */
describe("cashChange", () => {
  const due = billCents(3400);

  test.each([
    ["3400", 0],
    ["5000", 160000],
    ["10000", 660000],
    ["3 400", 0],
    ["3400,50", 50],
  ])("3400 due, %s received → %i cents of change", (received, change) => {
    expect(cashChange(due, received)).toEqual({ state: "ok", receivedCents: billCents(received.replace(/\s/g, "").replace(",", ".")), changeCents: change });
  });

  test("3000 received is 400 short, not a negative change", () => {
    expect(cashChange(due, "3000")).toEqual({ state: "short", receivedCents: 300000, missingCents: 40000 });
    expect(cashChange(due, "0")).toEqual({ state: "short", receivedCents: 0, missingCents: 340000 });
  });

  test("nothing typed shows no change at all", () => {
    expect(cashChange(due, "")).toEqual({ state: "empty" });
    expect(cashChange(due, "   ")).toEqual({ state: "empty" });
  });

  test.each(["-100", "abc", "5000.123", "1e4", "100000000", "5000.00.1"])("%s is not an amount", (bad) => {
    expect(cashChange(due, bad)).toEqual({ state: "invalid" });
  });

  test("cents never drift: 0.1 + 0.2 style sums stay exact", () => {
    expect(cashChange(billCents(0.3), "0.30")).toEqual({ state: "ok", receivedCents: 30, changeCents: 0 });
    expect(cashChange(billCents("1234.56"), "2000")).toEqual({ state: "ok", receivedCents: 200000, changeCents: 76544 });
  });
});
