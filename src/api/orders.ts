import { IOrder } from "@/types/pos";
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
  payment_method: PaymentMethod;
  /** Only for `other`: what it was (a transfer app, a voucher). */
  payment_method_other?: string;
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
  request<{ order: IOrder }>("/orders", { method: "POST", body });

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
