// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import PrepaidSettlement, { prepaidCashChange } from "./PrepaidSettlement";

/**
 * What goes back after a seat paid ahead (2026-11-17): the cash change from
 * the drawer, and — apart from it — what was paid by card goes back to the
 * card, never out of the drawer. All the server's figures.
 */
const t = (k: string) => k;
const money = (n: number) => String(n);
afterEach(cleanup);

describe("PrepaidSettlement", () => {
  test("all cash: the change, as before", () => {
    render(<PrepaidSettlement prepaid={{ amount: 2000, change: 500, due: 0 }} t={t} money={money} />);
    expect(screen.queryByTestId("receipt-prepaid-ways")).toBeNull();
    expect(screen.getByTestId("receipt-prepaid-change").textContent).toContain("500");
    expect(screen.queryByTestId("receipt-prepaid-card-refund")).toBeNull();
  });

  test("card 2 000, bill 1 500: 500 back to the card, NO cash change", () => {
    const prepaid = { amount: 2000, change: 500, due: 0, by_method: { card: 2000 }, refund: { card: 500 } };
    render(<PrepaidSettlement prepaid={prepaid} t={t} money={money} />);
    expect(screen.queryByTestId("receipt-prepaid-change")).toBeNull();
    const back = screen.getByTestId("receipt-prepaid-card-refund");
    expect(back.textContent).toContain("session.prepaid.cardRefund");
    expect(back.textContent).toContain("500");
    expect(prepaidCashChange(prepaid)).toBe(0);
  });

  test("cash 1 000 + card 1 000, bill 1 500: 500 cash change, nothing to the card", () => {
    const prepaid = { amount: 2000, change: 500, due: 0, by_method: { cash: 1000, card: 1000 }, refund: { cash: 500 } };
    render(<PrepaidSettlement prepaid={prepaid} t={t} money={money} />);
    expect(screen.getByTestId("receipt-prepaid-change").textContent).toContain("500");
    expect(screen.queryByTestId("receipt-prepaid-card-refund")).toBeNull();
    expect(prepaidCashChange(prepaid)).toBe(500);
  });

  test("after Stop with no cash handed over: the card refund still shows, no cash change", () => {
    const prepaid = { amount: 2000, change: 500, due: 0, by_method: { card: 2000 }, refund: { card: 500 } };
    render(<PrepaidSettlement prepaid={prepaid} changeAfterStop={prepaidCashChange(prepaid)} t={t} money={money} />);
    expect(screen.queryByTestId("receipt-prepaid-change")).toBeNull();
    expect(screen.getByTestId("receipt-prepaid-card-refund")).toBeTruthy();
  });

  // «Эти товары оплатили?» answered «Да» (2026-11-20, owner): paid during
  // play, so no «Доплатить»; after «Нет» (or no answer) the due as before.
  test("the due answered «Да»: paid in full, never «Доплатить»", () => {
    render(<PrepaidSettlement prepaid={{ amount: 170, change: 0, due: 700, by_method: { card: 170 }, refund: {} }} dueSettled t={t} money={money} />);
    expect(screen.queryByTestId("receipt-prepaid-due")).toBeNull();
    expect(screen.getByTestId("receipt-prepaid-full")).toBeTruthy();
    expect(screen.getByTestId("receipt-prepaid-amount").textContent).toContain("170");
  });

  test("the due answered «Нет» (not «Да»): «Доплатить» 700", () => {
    render(<PrepaidSettlement prepaid={{ amount: 170, change: 0, due: 700, by_method: { card: 170 }, refund: {} }} dueSettled={false} t={t} money={money} />);
    expect(screen.getByTestId("receipt-prepaid-due").textContent).toContain("700");
  });

  test("700 cash + 300 bonuses, bill 32.78 (2026-11-25, seen in the browser): 667.22 cash change AND the 300 back to the card", () => {
    render(<PrepaidSettlement prepaid={{ amount: 1000, change: 967.22, due: 0, by_method: { cash: 700, bonus: 300 }, refund: { cash: 667.22, bonus: 300 } }} t={t} money={money} />);
    expect(screen.getByTestId("receipt-prepaid-change").textContent).toContain("667.22");
    expect(screen.getByTestId("receipt-prepaid-bonus-back").textContent).toContain("300");
    expect(screen.getByTestId("receipt-prepaid-ways").textContent).toBe("session.payCash 700 · pay.bonus 300");
    expect(screen.queryByTestId("receipt-prepaid-card-refund")).toBeNull();
  });

  test("owing more: the due, as before", () => {
    render(<PrepaidSettlement prepaid={{ amount: 2000, change: 0, due: 500, by_method: { card: 2000 }, refund: {} }} t={t} money={money} />);
    expect(screen.getByTestId("receipt-prepaid-due").textContent).toContain("500");
  });
});
