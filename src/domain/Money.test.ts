import { describe, expect, it } from "vitest";
import { Money } from "./Money";

describe("Money", () => {
  it("zero is zero", () => expect(Money.zero().amount).toBe(0));

  it("adds same currency", () => {
    expect(new Money(10).add(new Money(15)).amount).toBe(25);
  });

  it("rejects mixing currencies", () => {
    expect(() => new Money(10, "USD").add(new Money(5, "AMD"))).toThrow();
  });

  it("multiplies and rounds to 2 decimals", () => {
    expect(new Money(10).multiply(0.333).amount).toBe(3.33);
  });

  it("computes percent", () => {
    expect(new Money(1000).percent(7.5).amount).toBe(75);
  });

  it("preserves currency through operations", () => {
    const m = new Money(100, "USD").multiply(2);
    expect(m.currency).toBe("USD");
    expect(m.amount).toBe(200);
  });

  it("formats with currency suffix", () => {
    expect(new Money(1234.5, "AMD").format()).toContain("AMD");
  });
});
