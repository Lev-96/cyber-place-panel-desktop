import { IOrder } from "@/types/pos";
import { IResolvedItems, PaymentMethod } from "./sessions";
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
}

export interface ListOrdersParams {
  branch_id: number;
  /** Inclusive lower bound, wall-clock "YYYY-MM-DD HH:mm:ss" (backend app tz). */
  date_from?: string;
  /** Inclusive upper bound, wall-clock "YYYY-MM-DD HH:mm:ss" (backend app tz). */
  date_to?: string;
}

export const apiCreateOrder = (body: CreateOrderBody) =>
  request<{ order: IOrder }>("/orders", { method: "POST", body });

export const apiListOrders = (params: ListOrdersParams) =>
  request<{ data: IOrder[] }>("/orders", { params });

/**
 * Typed lines read against the branch's catalogue — the SAME resolver the
 * session bill's quick entry uses, for a sale with no seat. Writes nothing.
 */
export const apiResolveOrderItems = (branchId: number, text: string) =>
  request<{ resolved: IResolvedItems }>("/orders/resolve", {
    method: "POST",
    body: { branch_id: branchId, text },
  });
