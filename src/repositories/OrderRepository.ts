import { apiCreateOrder, apiListOrders, apiVoidOrder, CreateOrderBody } from "@/api/orders";
import { IOrder } from "@/types/pos";

export class OrderRepository {
  async listByBranch(branchId: number): Promise<IOrder[]> { return (await apiListOrders(branchId)).data; }
  async create(b: CreateOrderBody): Promise<IOrder> { return (await apiCreateOrder(b)).order; }
  async void(id: number): Promise<IOrder> { return (await apiVoidOrder(id)).order; }
}

export const orderRepository = new OrderRepository();
