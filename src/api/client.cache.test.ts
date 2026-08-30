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

/** Wait until the background revalidation has actually finished. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

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

  /**
   * The rule changed on 2026-08-31, deliberately.
   *
   * A repeat read is still answered from memory — that is what makes moving
   * between screens instant — but it no longer means silence. Serving the
   * cached copy alone left an operator working from data up to a minute old
   * whenever somebody ELSE changed it, because inside the freshness window no
   * request left the machine at all.
   */
  it("answers a repeat read from memory, without waiting for the network", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ data: [{ id: 1 }] }));

    const first = await request("/products");
    const callsAfterFirst = fetchMock.mock.calls.length;
    const second = await request("/products");

    // The answer came from the cache: identical, and not from a fresh parse of
    // a second body the caller waited for.
    expect(second).toEqual(first);
    expect(callsAfterFirst).toBe(1);
  });

  it("asks the server anyway, in the background, so somebody else's change lands", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1 }] }));
    await request("/products");

    // Somebody edits the catalogue elsewhere; our copy is still inside its
    // freshness window and would once have been served for another minute.
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1 }, { id: 2 }] }));
    const changed: string[] = [];
    const stop = apiCache.subscribe((key) => changed.push(key));

    await request("/products");
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The screen is told, once, and only because the body actually differed.
    expect(changed).toEqual(["/products"]);
    // And the next read is the new one.
    expect(await request("/products")).toEqual({ data: [{ id: 1 }, { id: 2 }] });
    stop();
  });

  it("an unchanged answer notifies nobody", async () => {
    // A fresh Response per call, deliberately: a body can only be read once,
    // and reusing one instance would make the background revalidation fail
    // silently — the test would then pass by never exercising the path.
    fetchMock.mockImplementation(async () => jsonResponse({ data: [{ id: 1 }] }));
    await request("/products");

    const changed: string[] = [];
    const stop = apiCache.subscribe((key) => changed.push(key));
    await request("/products");
    await settle();

    // The revalidation DID happen — this is not passing by never asking.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    // And it came back the same, so it must not re-render the screen.
    expect(changed).toEqual([]);
    stop();
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

    // Aged past its TTL: the next read must revalidate and WAIT for the answer.
    apiCache.lookup("/products")!.storedAt -= 10 * 60 * 1000;
    fetchMock.mockResolvedValueOnce(notModified());
    await request("/products");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Fresh again, so the third read is answered from memory — and, as of the
    // stale-data fix, revalidated in the background rather than in silence.
    fetchMock.mockResolvedValueOnce(notModified());
    await request("/products");
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    // The last call was conditional — that is what makes it nearly free.
    const headers = fetchMock.mock.calls[2][1]?.headers as Record<string, string>;
    expect(headers["If-None-Match"]).toBeTruthy();
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
