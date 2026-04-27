import { IOrder } from "@/types/pos";
import { request } from "./client";

export interface CreateOrderBody {
  branch_id: number;
  member_id?: number | null;
  gaming_session_id?: number | null;
  payment_method: "cash" | "card" | "deposit";
  items: Array<{ product_id: number; quantity: number }>;
}

export const apiCreateOrder = (body: CreateOrderBody) =>
  request<{ order: IOrder }>("/orders", { method: "POST", body });

export const apiListOrders = (branchId: number) =>
  request<{ data: IOrder[] }>("/orders", { params: { branch_id: branchId } });

export const apiVoidOrder = (id: number) =>
  request<{ order: IOrder }>(`/orders/${id}/void`, { method: "POST" });
