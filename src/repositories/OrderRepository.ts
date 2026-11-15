import {
  apiCreateOrder, apiListOrders, apiResolveOrderItems,
  CreateOrderBody, ListOrdersParams,
} from "@/api/orders";
import { friendlyMutation } from "@/api/fallback";
import { IItemChoice, IResolvedItems } from "@/api/sessions";
import { IOrder } from "@/types/pos";
import { announceStockWarnings } from "@/ui/stockWarnings";

/**
 * The till's sales. The list is NOT wrapped in a fallback: a history of money
 * that silently reads as empty when the request failed says "nothing was sold"
 * — the screen shows the error instead.
 */
export class OrderRepository {
  async create(body: CreateOrderBody): Promise<IOrder> {
    // A sale that took a counted product below zero says so (2026-11-16);
    // the sale itself is the server's, unchanged.
    return friendlyMutation(apiCreateOrder(body).then((r) => { announceStockWarnings(r); return r.order; }));
  }
  async list(params: ListOrdersParams): Promise<IOrder[]> {
    return apiListOrders(params).then((r) => r.data);
  }
  async resolveItemsText(branchId: number, text: string, choices?: IItemChoice[]): Promise<IResolvedItems> {
    return friendlyMutation(apiResolveOrderItems(branchId, text, choices).then((r) => r.resolved));
  }
}

export const orderRepository = new OrderRepository();
