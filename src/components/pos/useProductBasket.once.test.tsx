// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useProductBasket } from "./useProductBasket";

/**
 * A basket line marked `once` — an additional item — holds exactly one: a
 * second put and the stepper's + leave it at 1, and − takes it out. The panel
 * also disables those buttons; this is the rule underneath them.
 */

vi.mock("@/repositories/ProductRepository", () => ({
  productRepository: { listByBranch: async () => [] },
}));

const mountBasket = () =>
  renderHook(() => useProductBasket({ branchId: 1, resolve: async () => ({ lines: [], items: [], total: 0, ok: false }), resolveKey: 1 }));

const cue = { key: "p:41", product_id: 41, name: "Billiard Cue", price: 500, once: true };
const cola = { key: "p:10", product_id: 10, name: "Cola", price: 600 };

describe("useProductBasket — a once line", () => {
  test("a second put leaves it at one; an ordinary line still counts up", () => {
    const { result } = mountBasket();
    act(() => { result.current.put(cue); });
    act(() => { result.current.put(cue); });
    act(() => { result.current.put(cola); });
    act(() => { result.current.put(cola); });
    expect(result.current.cart.map((l) => [l.key, l.qty])).toEqual([["p:41", 1], ["p:10", 2]]);
  });

  test("+ cannot raise it; − takes it out", () => {
    const { result } = mountBasket();
    act(() => { result.current.put(cue); });
    act(() => { result.current.step("p:41", 1); });
    expect(result.current.cart[0].qty).toBe(1);
    act(() => { result.current.step("p:41", -1); });
    expect(result.current.cart).toEqual([]);
  });
});
