import { describe, expect, test } from "vitest";
import type { IOrder } from "@/types/pos";
import { saleCashText, saleItemsText, salePaymentText, saleSellerText } from "./tillSaleText";

/** One plain sentence per till sale, the same in «Касса» and the history. */
const t = (k: string) => ({
  "session.payCash": "Наличные", "session.payOther": "Другой способ", "till.receivedShort": "Получено",
  "till.changeShort": "Сдача", "till.soldBy": "Продал", "role.manager": "Менеджер",
} as Record<string, string>)[k] ?? k;
const money = (n: number) => `${n} драм`;
const order = (over: Partial<IOrder> = {}): IOrder => ({
  id: 1, branch_id: 7, subtotal: 1400, total: 1400, payment_method: "cash", status: "paid", created_at: "2026-10-25T10:00:00Z",
  items: [
    { id: 1, product_name: "Чипсы", quantity: 2, unit_price: 500, line_total: 1000 },
    { id: 2, product_name: "Кола", quantity: 1, unit_price: 400, line_total: 400 },
  ] as unknown as IOrder["items"],
  cashier: { id: 3, name: "Иван", role: "manager" },
  ...over,
});

describe("a till sale in words", () => {
  test("what was sold", () => {
    expect(saleItemsText(order())).toBe("Чипсы × 2, Кола × 1");
  });

  test("how it was paid, an other method with its note", () => {
    expect(salePaymentText(order(), t)).toBe("Наличные");
    expect(salePaymentText(order({ payment_method: "other", payment_method_other: "Idram" }), t)).toBe("Другой способ: Idram");
  });

  test("handed over and given back, from the server", () => {
    expect(saleCashText(order({ cash_received: "2000.00", change: 600 }), t, money)).toBe("Получено 2000 драм · Сдача 600 драм");
    expect(saleCashText(order({ cash_received: null }), t, money)).toBeNull();
  });

  test("who sold it, with the role", () => {
    expect(saleSellerText(order(), t)).toBe("Продал: Иван · Менеджер");
    expect(saleSellerText(order({ cashier: null }), t)).toBeNull();
  });
});
