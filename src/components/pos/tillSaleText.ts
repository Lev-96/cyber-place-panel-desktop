import type { IOrder } from "@/types/pos";

/**
 * A till sale said in plain words (2026-10-25) — one wording for «Касса» and
 * for the sales history, so an owner reads the same sentence wherever it is:
 * what was sold, for how much, how it was paid, what was handed over and given
 * back, and who sold it. Every figure is the server's.
 */
type T = (key: string) => string;
type Money = (n: number) => string;

export const PAYMENT_LABEL_KEY: Record<IOrder["payment_method"], string> = {
  cash: "session.payCash",
  card: "session.payCard",
  other: "session.payOther",
  deposit: "till.payDeposit",
};

/** "Чипсы × 2, Кола × 1". */
export const saleItemsText = (o: IOrder): string =>
  (o.items ?? []).map((i) => `${i.product_name} × ${i.quantity}`).join(", ");

/** "Наличные", or "Другой способ: Idram". */
export const salePaymentText = (o: IOrder, t: T): string =>
  o.payment_method === "other" && o.payment_method_other
    ? `${t(PAYMENT_LABEL_KEY.other)}: ${o.payment_method_other}`
    : t(PAYMENT_LABEL_KEY[o.payment_method]);

/** "Получено 2 000 · Сдача 600", or null when nothing was typed. */
export const saleCashText = (o: IOrder, t: T, money: Money): string | null => {
  if (o.cash_received === null || o.cash_received === undefined) return null;
  const received = Number(o.cash_received);
  const change = o.change !== null && o.change !== undefined ? Number(o.change) : received - Number(o.total);
  return `${t("till.receivedShort")} ${money(received)} · ${t("till.changeShort")} ${money(change)}`;
};

/** "Продал: Иван · Менеджер", or null for a sale with no cashier on record. */
export const saleSellerText = (o: IOrder, t: T): string | null => {
  if (!o.cashier) return null;
  const role = t(`role.${o.cashier.role}`);
  return `${t("till.soldBy")}: ${o.cashier.name}${role && role !== `role.${o.cashier.role}` ? ` · ${role}` : ""}`;
};
