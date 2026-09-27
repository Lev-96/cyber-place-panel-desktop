import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/** Each toast names what it is about: a product, or an additional item. */

vi.mock("@/api/products", () => ({
  apiCreateProduct: vi.fn(async () => ({ product: { id: 1 } })),
  apiUpdateProduct: vi.fn(async () => ({ product: { id: 1 } })),
  apiDeleteProduct: vi.fn(async () => ({ message: "ok" })),
  apiListProducts: vi.fn(async () => ({ data: [] })),
}));
vi.mock("@/api/fallback", () => ({ friendlyMutation: <T,>(p: Promise<T>) => p, orFallback: <T,>(p: Promise<T>) => p }));

import { notify, ToastEvent } from "@/ui/notify";
import { productRepository } from "./ProductRepository";

let seen: ToastEvent[] = [];
let off: () => void = () => {};
beforeEach(() => { seen = []; off = notify.subscribe((e) => seen.push(e)); });
afterEach(() => off());

describe("ProductRepository toasts", () => {
  test("a product is announced as a product", async () => {
    await productRepository.create({ branch_id: 1, name: "Tea", price: 300 });
    await productRepository.update(1, { price: 350 });
    await productRepository.remove(1);
    expect(seen.map((e) => `${e.entity}.${e.action}`)).toEqual(["product.created", "product.updated", "product.deleted"]);
  });

  test("an additional item is announced as one", async () => {
    await productRepository.create({ branch_id: 1, name: "Cue", price: 500, kind: "additional" });
    await productRepository.update(1, { is_active: false }, "additional");
    await productRepository.remove(1, "additional");
    expect(seen.map((e) => `${e.entity}.${e.action}`)).toEqual([
      "additionalItem.created", "additionalItem.updated", "additionalItem.deleted",
    ]);
  });
});
