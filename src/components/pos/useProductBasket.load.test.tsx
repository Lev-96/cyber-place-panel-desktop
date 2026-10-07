// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * The catalogue read of the basket (both the session dialog and the till).
 * It had no catch: a failed read left `products` null, so the picker showed
 * its skeleton for ever. Now the failure is kept and the picker says so, with
 * Retry, and never claims "no products".
 */

const repo = vi.hoisted(() => ({ listByBranch: vi.fn() }));
vi.mock("@/repositories/ProductRepository", () => ({
  productRepository: { listByBranch: (...a: unknown[]) => repo.listByBranch(...a) },
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, money: (n: number) => String(n), lang: "en" }),
}));

import { useProductBasket } from "./useProductBasket";
import { BasketPicker } from "./ProductBasketPanels";

const resolve = async () => ({ lines: [], items: [], total: 0, ok: false });
const TEA = { id: 1, branch_id: 1, name: "Tea", price: 300, category: "", is_active: true, kind: "regular" };

const Harness = () => {
  const basket = useProductBasket({ branchId: 1, resolve, resolveKey: 1 } as Parameters<typeof useProductBasket>[0]);
  return <BasketPicker basket={basket} saving={false} canCreateProducts={false} />;
};

afterEach(() => { cleanup(); repo.listByBranch.mockReset(); });

describe("useProductBasket — the catalogue read", () => {
  test("a failure stops loading and is kept", async () => {
    repo.listByBranch.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useProductBasket({ branchId: 1, resolve, resolveKey: 1 } as Parameters<typeof useProductBasket>[0]));
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.products).toBeNull();
    expect(result.current.productsError).toBeInstanceOf(TypeError);
  });

  test("the picker shows offline + Retry, never «no products»; Retry loads the catalogue", async () => {
    repo.listByBranch.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue([TEA]);
    await act(async () => { render(<Harness />); });

    expect(screen.getByText("state.offline.title")).toBeTruthy();
    expect(screen.queryByText("session.noProducts")).toBeNull();

    await act(async () => { screen.getByRole("button", { name: "action.retry" }).click(); });
    expect(repo.listByBranch).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Tea")).toBeTruthy();
    expect(screen.queryByText("state.offline.title")).toBeNull();
  });

  test("an empty catalogue is the empty state", async () => {
    repo.listByBranch.mockResolvedValue([]);
    await act(async () => { render(<Harness />); });
    expect(screen.getByText("session.noProducts")).toBeTruthy();
  });
});
