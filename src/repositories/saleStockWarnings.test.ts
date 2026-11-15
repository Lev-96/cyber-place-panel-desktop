import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The till's and the bill's repositories hand a sale's `stock_warnings` to the
 * amber toast (2026-11-16) and return exactly what they always returned.
 */
const api = vi.hoisted(() => ({ order: vi.fn(), items: vi.fn(), item: vi.fn(), qty: vi.fn() }));
const announced = vi.hoisted(() => ({ calls: [] as unknown[] }));
vi.mock("@/ui/stockWarnings", () => ({ announceStockWarnings: (b: unknown) => { announced.calls.push(b); } }));
vi.mock("@/api/orders", () => ({ apiCreateOrder: (...a: unknown[]) => api.order(...a), apiListOrders: vi.fn(), apiResolveOrderItems: vi.fn() }));
vi.mock("@/api/sessions", async (orig) => ({
  ...(await orig<object>()),
  apiAddSessionItems: (...a: unknown[]) => api.items(...a),
  apiAddSessionItem: (...a: unknown[]) => api.item(...a),
  apiSetSessionItemQty: (...a: unknown[]) => api.qty(...a),
}));

import { orderRepository } from "./OrderRepository";
import { sessionRepository } from "./SessionRepository";

const WARN = [{ product_id: 1, name: "Cola", stock: -2 }];

beforeEach(() => { announced.calls = []; Object.values(api).forEach((f) => f.mockReset()); });

describe("a sale's stock warnings", () => {
  it("the till: the order comes back as before, the warnings go to the toast", async () => {
    api.order.mockResolvedValue({ order: { id: 9 }, stock_warnings: WARN });
    expect(await orderRepository.create({ branch_id: 1, items: [], client_request_id: "x" })).toEqual({ id: 9 });
    expect(announced.calls).toEqual([{ order: { id: 9 }, stock_warnings: WARN }]);
  });

  it("a seat: the basket, one line and a corrected count, each announced", async () => {
    api.items.mockResolvedValue({ session: { id: 5 }, stock_warnings: WARN });
    api.item.mockResolvedValue({ item: { id: 1 }, session: { id: 5 } });
    api.qty.mockResolvedValue({ session: { id: 5 }, stock_warnings: WARN });
    expect(await sessionRepository.addItems(5, [{ product_id: 1, qty: 3 }])).toEqual({ id: 5 });
    expect(await sessionRepository.addItem(5, { product_id: 1, qty: 1 })).toEqual({ id: 5 });
    expect(await sessionRepository.setItemQty(5, 1, 4)).toEqual({ id: 5 });
    expect(announced.calls).toHaveLength(3);
  });
});
