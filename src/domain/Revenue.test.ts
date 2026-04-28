import { describe, expect, it } from "vitest";
import { Money } from "./Money";
import { RevenueReport } from "./Revenue";

describe("RevenueReport.amountDue", () => {
  it("computes commission of gross", () => {
    const r = new RevenueReport(1, new Date(), new Date(), new Money(10000), 7, 5);
    expect(r.amountDue().amount).toBe(700);
  });

  it("zero commission yields zero", () => {
    const r = new RevenueReport(1, new Date(), new Date(), new Money(10000), 0, 5);
    expect(r.amountDue().amount).toBe(0);
  });

  it("preserves currency", () => {
    const r = new RevenueReport(1, new Date(), new Date(), new Money(1000, "USD"), 10, 3);
    expect(r.amountDue().currency).toBe("USD");
    expect(r.amountDue().amount).toBe(100);
  });
});
