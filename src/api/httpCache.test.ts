import { describe, expect, it } from "vitest";
import { HttpCache, invalidationTargets, policyFor } from "./httpCache";

const makeCache = (overrides: Partial<ConstructorParameters<typeof HttpCache>[0]> = {}) => {
  let clock = 1_000_000;
  const cache = new HttpCache({
    maxEntries: 5,
    maxBytes: 1000,
    idleEvictMs: 10_000,
    now: () => clock,
    ...overrides,
  });
  return { cache, advance: (ms: number) => { clock += ms; } };
};

describe("HttpCache", () => {
  it("returns what was stored", () => {
    const { cache } = makeCache();
    cache.store("/products", '{"a":1}', 'W/"x"');

    expect(cache.lookup("/products")?.text).toBe('{"a":1}');
    expect(cache.lookup("/products")?.etag).toBe('W/"x"');
  });

  it("reports age so callers can judge freshness", () => {
    const { cache, advance } = makeCache();
    cache.store("/products", "{}", null);
    advance(2_500);

    expect(cache.age(cache.lookup("/products")!)).toBe(2_500);
  });

  it("restarts the clock on a 304", () => {
    const { cache, advance } = makeCache();
    cache.store("/products", "{}", null);
    advance(5_000);
    cache.touch("/products");
    advance(1_000);

    expect(cache.age(cache.lookup("/products")!)).toBe(1_000);
  });

  it("never exceeds its entry ceiling", () => {
    const { cache } = makeCache({ maxEntries: 3 });
    for (let i = 0; i < 10; i++) cache.store(`/p/${i}`, "{}", null);

    expect(cache.stats().entries).toBe(3);
  });

  it("never exceeds its byte ceiling", () => {
    const { cache } = makeCache({ maxBytes: 100, maxEntries: 100 });
    for (let i = 0; i < 20; i++) cache.store(`/p/${i}`, "x".repeat(30), null);

    expect(cache.stats().bytes).toBeLessThanOrEqual(100);
  });

  it("evicts the least recently used entry first", () => {
    const { cache } = makeCache({ maxEntries: 2 });
    cache.store("/a", "{}", null);
    cache.store("/b", "{}", null);
    cache.lookup("/a");          // /a is now the most recently used
    cache.store("/c", "{}", null);

    expect(cache.lookup("/a")).toBeDefined();
    expect(cache.lookup("/b")).toBeUndefined();
  });

  it("refuses a payload larger than the whole budget", () => {
    const { cache } = makeCache({ maxBytes: 50 });
    cache.store("/huge", "x".repeat(500), null);

    // Storing it would have evicted everything else just to be evicted
    // itself on the next insert.
    expect(cache.lookup("/huge")).toBeUndefined();
    expect(cache.stats().bytes).toBe(0);
  });

  it("keeps byte accounting correct when a key is overwritten", () => {
    const { cache } = makeCache();
    cache.store("/a", "x".repeat(100), null);
    cache.store("/a", "x".repeat(10), null);

    expect(cache.stats()).toEqual({ entries: 1, bytes: 10 });
  });

  it("drops a whole path prefix on invalidation, query strings included", () => {
    const { cache } = makeCache();
    cache.store("/products", "{}", null);
    cache.store("/products?branch_id=2", "{}", null);
    cache.store("/places", "{}", null);

    cache.invalidatePrefix("/products");

    expect(cache.lookup("/products")).toBeUndefined();
    expect(cache.lookup("/products?branch_id=2")).toBeUndefined();
    expect(cache.lookup("/places")).toBeDefined();
  });

  it("does not let a prefix match a different resource with the same start", () => {
    const { cache } = makeCache();
    cache.store("/branch-subplatforms", "{}", null);
    cache.invalidatePrefix("/branches");

    expect(cache.lookup("/branch-subplatforms")).toBeDefined();
  });

  it("sweeps entries nobody has touched", () => {
    const { cache, advance } = makeCache({ idleEvictMs: 10_000 });
    cache.store("/old", "{}", null);
    advance(5_000);
    cache.store("/new", "{}", null);
    advance(6_000);

    cache.sweep();

    expect(cache.lookup("/old")).toBeUndefined();
    expect(cache.lookup("/new")).toBeDefined();
    expect(cache.stats().bytes).toBe(2);
  });

  it("clears completely", () => {
    const { cache } = makeCache();
    cache.store("/a", "{}", null);
    cache.clear();

    expect(cache.stats()).toEqual({ entries: 0, bytes: 0 });
  });
});

describe("policyFor", () => {
  it("caches reference data", () => {
    expect(policyFor("/products")).not.toBeNull();
    expect(policyFor("/branches")).not.toBeNull();
    expect(policyFor("/branches/7")).not.toBeNull();
  });

  it("never caches live data", () => {
    // These drive the floor board, the cash drawer and the alert badge.
    // A stale answer here is a wrong answer to a human standing at a
    // counter, which is exactly what this cache must never produce.
    for (const path of ["/sessions", "/pcs", "/orders", "/shifts", "/notifications", "/bookings", "/members", "/users"]) {
      expect(policyFor(path), path).toBeNull();
    }
  });

  it("does not confuse a prefix with a longer resource name", () => {
    // "/branches" must not swallow "/branch-platform-prices" by accident
    // in either direction.
    expect(policyFor("/branch-platform-prices")?.ttlMs).toBe(60_000);
    expect(policyFor("/branches")?.ttlMs).toBe(30_000);
  });
});

describe("invalidationTargets", () => {
  it("expands a write to everything that embeds it", () => {
    expect(invalidationTargets("/branch-platform-prices/3")).toContain("/places");
    expect(invalidationTargets("/sessions")).toContain("/places");
    expect(invalidationTargets("/pcs/9/wake")).toContain("/places");
  });

  it("falls back to the resource itself for anything unmapped", () => {
    expect(invalidationTargets("/whatever/5")).toEqual(["/whatever"]);
  });
});
