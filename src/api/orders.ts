import { IOrder } from "@/types/pos";
import { request } from "./client";

export interface CreateOrderBody {
  branch_id: number;
  member_id?: number | null;
  gaming_session_id?: number | null;
  payment_method: "cash" | "card" | "deposit";
  items: Array<{ product_id: number; quantity: number }>;
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

export const apiVoidOrder = (id: number) =>
  request<{ order: IOrder }>(`/orders/${id}/void`, { method: "POST" });
