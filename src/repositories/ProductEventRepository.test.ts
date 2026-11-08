import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The product trail's transport (2026-11-09): the list goes out with exactly
 * the filters given, the actors arrive in either Laravel shape, and only a
 * 404 / 501 means "this backend has no trail" — a failure of any other kind
 * keeps the entry, so the screen can say what went wrong.
 */
const http = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/api/client", () => ({ request: (...a: unknown[]) => http.request(...a) }));

import { productEventRepository } from "./ProductEventRepository";

const apiError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

beforeEach(() => http.request.mockReset());

describe("list", () => {
  test("GET /product-events with the filters and the page as query params", async () => {
    http.request.mockResolvedValue({ data: [], meta: { current_page: 2, last_page: 3, per_page: 20, total: 41 } });
    await productEventRepository.list({ branch_id: 3, user_id: 10, action: "price_changed", from: "2026-11-01", page: 2, per_page: 20 });
    expect(http.request).toHaveBeenCalledWith("/product-events", {
      params: { branch_id: 3, user_id: 10, action: "price_changed", from: "2026-11-01", page: 2, per_page: 20 },
    });
  });
});

describe("actors", () => {
  test("narrowed by the branch, read from `data`", async () => {
    http.request.mockResolvedValue({ data: [{ id: 10, name: "Anna", role: "manager" }] });
    expect(await productEventRepository.actors(3)).toEqual([{ id: 10, name: "Anna", role: "manager" }]);
    expect(http.request).toHaveBeenCalledWith("/product-events/actors", { params: { branch_id: 3 } });
  });

  test("a bare list is read the same", async () => {
    http.request.mockResolvedValue([{ id: 11, name: "Aram", role: "company_owner" }]);
    expect(await productEventRepository.actors(3)).toEqual([{ id: 11, name: "Aram", role: "company_owner" }]);
  });
});

describe("available", () => {
  test("a backend that answers has the trail", async () => {
    http.request.mockResolvedValue({ data: [] });
    expect(await productEventRepository.available(3)).toBe(true);
  });

  test("404 and 501 mean it is not deployed", async () => {
    http.request.mockRejectedValueOnce(apiError(404));
    expect(await productEventRepository.available(3)).toBe(false);
    http.request.mockRejectedValueOnce(apiError(501));
    expect(await productEventRepository.available(3)).toBe(false);
  });

  test("a 500 or a dropped connection keeps the entry (the history shows the error)", async () => {
    http.request.mockRejectedValueOnce(apiError(500));
    expect(await productEventRepository.available(3)).toBe(true);
    http.request.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await productEventRepository.available(3)).toBe(true);
  });
});
