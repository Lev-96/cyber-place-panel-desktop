import { IOrder, IStockWarning } from "@/types/pos";
import { IItemChoice, IResolvedItems, PaymentMethod } from "./sessions";
import { request } from "./client";

/**
 * A sale at the till — the backend's `orders`, never a session (2026-09-24).
 *
 * Priced on the server from the catalogue; nothing here carries a price.
 * `client_request_id` is this press of "Sell": sent again (a double click, a
 * retry) it returns the sale already made instead of making a second one.
 */
export interface CreateOrderBody {
  branch_id: number;
  /** One method (every server takes it) … */
  payment_method?: PaymentMethod | "bonus";
  /** Only for `other`: what it was (a transfer app, a voucher). */
  payment_method_other?: string;
  /** … or SPLIT (2026-11-07): the parts, summing to the total, and how. Never `deposit`. */
  payments?: { method: "cash" | "card" | "other" | "bonus"; amount: number }[];
  /** The Club Card the bonuses are spent from (2026-11-25); this branch's. */
  bonus_account_id?: number;
  payment_note?: string;
  items: Array<{ product_id: number; quantity: number }>;
  client_request_id: string;
  /**
   * Cash only, optional (2026-10-25): the banknotes handed over, so the
   * server checks the change shown against the total it prices, and keeps
   * it for the history.
   */
  cash_received?: string;
}

export interface ListOrdersParams {
  branch_id: number;
  /** Inclusive lower bound, wall-clock "YYYY-MM-DD HH:mm:ss" (backend app tz). */
  date_from?: string;
  /** Inclusive upper bound, wall-clock "YYYY-MM-DD HH:mm:ss" (backend app tz). */
  date_to?: string;
  /** One seller's sales (the history's person filter). */
  cashier_user_id?: number;
  /** Up to 1 000; the server's default is 200. */
  limit?: number;
}

export const apiCreateOrder = (body: CreateOrderBody) =>
  // `stock_warnings` (2026-11-16): only when the sale took a counted product below zero.
  request<{ order: IOrder; stock_warnings?: IStockWarning[] }>("/orders", { method: "POST", body });

export const apiListOrders = (params: ListOrdersParams) =>
  request<{ data: IOrder[] }>("/orders", { params });

/**
 * Typed lines read against the branch's catalogue — the SAME resolver the
 * session bill's quick entry uses, for a sale with no seat. Writes nothing.
 */
export const apiResolveOrderItems = (branchId: number, text: string, choices?: IItemChoice[]) =>
  request<{ resolved: IResolvedItems }>("/orders/resolve", {
    method: "POST",
    body: choices && choices.length > 0 ? { branch_id: branchId, text, choices } : { branch_id: branchId, text },
  });
