import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The client reads a token and a base URL at call time; both are stubbed
// so these tests are about caching behaviour and nothing else.
vi.mock("@/infrastructure/AppConfig", () => ({
  AppConfig: { backendUrl: "http://backend.test", storageKeys: { token: "token", user: "user" } },
}));
vi.mock("@/infrastructure/KeyValueStore", () => ({
  keyValueStore: { get: async () => "test-token", set: async () => {}, remove: async () => {} },
}));

import { apiCache, request } from "./client";

const jsonResponse = (body: unknown, etag = 'W/"v1"') =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ETag: etag },
  });

const notModified = () => new Response(null, { status: 304 });

describe("request() caching", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiCache.clear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    apiCache.clear();
  });

  it("serves a repeat read without touching the network", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1 }] }));

    const first = await request("/products");
    const second = await request("/products");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("hands each caller its own object so one screen cannot corrupt another", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1 }] }));

    const first = await request<{ data: { id: number }[] }>("/products");
    first.data[0].id = 999;
    const second = await request<{ data: { id: number }[] }>("/products");

    expect(second.data[0].id).toBe(1);
  });

  it("never caches live endpoints", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ data: [] }));

    await request("/sessions");
    await request("/sessions");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats a different query string as a different entry", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ data: [] }));

    await request("/products", { params: { branch_id: 1 } });
    await request("/products", { params: { branch_id: 2 } });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("revalidates a stale entry and accepts a 304 without re-parsing a body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1 }] }));
    await request("/products");

    // Age the entry past its TTL by rewriting its timestamp.
    const entry = apiCache.lookup("/products")!;
    entry.storedAt -= 10 * 60 * 1000;

    fetchMock.mockResolvedValueOnce(notModified());
    const result = await request<{ data: { id: number }[] }>("/products");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers["If-None-Match"]).toBe('W/"v1"');
    // A 304 is not `res.ok` — if it were handled after the ok-check it
    // would surface as a thrown ApiError instead of a cache hit.
    expect(result.data[0].id).toBe(1);
  });

  it("a 304 restarts the freshness window", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
    await request("/products");

    apiCache.lookup("/products")!.storedAt -= 10 * 60 * 1000;
    fetchMock.mockResolvedValueOnce(notModified());
    await request("/products");

    await request("/products");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a write by this client invalidates its own next read", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1 }] }));
    await request("/products");

    fetchMock.mockResolvedValueOnce(jsonResponse({ product: { id: 2 } }));
    await request("/products", { method: "POST", body: { name: "Fanta" } });

    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1 }, { id: 2 }] }));
    const after = await request<{ data: unknown[] }>("/products");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(after.data).toHaveLength(2);
  });

  it("a write invalidates the other resources that embed it", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
    await request("/places");

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await request("/branch-platform-prices/3", { method: "PUT", body: { price: 10 } });

    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
    await request("/places");

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("a failed write leaves the cache intact", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
    await request("/products");

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "nope" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(request("/products", { method: "POST", body: {} })).rejects.toThrow();

    expect(apiCache.lookup("/products")).toBeDefined();
  });

  it("noCache forces a network read", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ data: [] }));

    await request("/products");
    await request("/products", { noCache: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache an error response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "boom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(request("/products")).rejects.toThrow();
    expect(apiCache.lookup("/products")).toBeUndefined();
  });
});
