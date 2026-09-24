import {
  apiCreateOrder, apiListOrders, apiResolveOrderItems,
  CreateOrderBody, ListOrdersParams,
} from "@/api/orders";
import { friendlyMutation } from "@/api/fallback";
import { IResolvedItems } from "@/api/sessions";
import { IOrder } from "@/types/pos";

/**
 * The till's sales. The list is NOT wrapped in a fallback: a history of money
 * that silently reads as empty when the request failed says "nothing was sold"
 * — the screen shows the error instead.
 */
export class OrderRepository {
  async create(body: CreateOrderBody): Promise<IOrder> {
    return friendlyMutation(apiCreateOrder(body).then((r) => r.order));
  }
  async list(params: ListOrdersParams): Promise<IOrder[]> {
    return apiListOrders(params).then((r) => r.data);
  }
  async resolveItemsText(branchId: number, text: string): Promise<IResolvedItems> {
    return friendlyMutation(apiResolveOrderItems(branchId, text).then((r) => r.resolved));
  }
}

export const orderRepository = new OrderRepository();
