import { apiCreateOrder, apiListOrders, apiVoidOrder, CreateOrderBody } from "@/api/orders";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { IOrder } from "@/types/pos";

export class OrderRepository {
  async listByBranch(branchId: number): Promise<IOrder[]> { return orFallback(apiListOrders(branchId).then((r) => r.data), []); }
  async create(b: CreateOrderBody): Promise<IOrder> { return friendlyMutation(apiCreateOrder(b).then((r) => r.order)); }
  async void(id: number): Promise<IOrder> { return friendlyMutation(apiVoidOrder(id).then((r) => r.order)); }
}

export const orderRepository = new OrderRepository();
