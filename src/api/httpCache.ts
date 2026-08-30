/**
 * A small, strictly bounded HTTP cache for GET responses.
 *
 * Why this exists at all, given the backend now caches too: the two solve
 * different halves of the same problem. The server cache removes database
 * work; this removes the *round trip*, the JSON transfer and — on a 304 —
 * the re-render that follows a fresh payload. On a panel that polls every
 * 30 seconds and is left open all shift, that is the difference between a
 * constant low hum of work and a genuinely idle process.
 *
 * Three design rules keep it from becoming the thing that makes the app
 * slow instead:
 *
 *  1. MEMORY ONLY. Nothing is written to disk, so there is no cache
 *     directory to grow without bound across weeks of uptime, and a
 *     restart is always a clean slate.
 *  2. HARD CEILINGS. Both the entry count and the total byte size are
 *     capped; inserting past a ceiling evicts least-recently-used entries.
 *     RAM use is therefore bounded by construction, not by hope.
 *  3. OPT-IN. Only paths with an explicit policy are cached. Live data
 *     (sessions, PCs, orders, shifts, notifications) is never served from
 *     here, so nothing this file does can make the floor board show a
 *     stale state.
 *
 * Bodies are kept as raw text and parsed on each read. That costs a
 * sub-millisecond parse but means a caller can freely mutate what it gets
 * back without corrupting what the next caller sees — a cache that hands
 * out shared mutable objects is a bug generator.
 */

export interface CacheEntry {
  text: string;
  etag: string | null;
  storedAt: number;
  bytes: number;
}

export interface HttpCacheOptions {
  maxEntries: number;
  maxBytes: number;
  /** Entries untouched for this long are dropped by the janitor. */
  idleEvictMs: number;
  now?: () => number;
}

export class HttpCache {
  // Map iteration order is insertion order, which gives us LRU for free:
  // re-inserting on read moves an entry to the back, so the front is
  // always the least recently used.
  private entries = new Map<string, CacheEntry>();
  private bytes = 0;
  private readonly now: () => number;

  constructor(private readonly options: HttpCacheOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  lookup(key: string): CacheEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  store(key: string, text: string, etag: string | null): void {
    const existing = this.entries.get(key);
    if (existing) {
      this.bytes -= existing.bytes;
      this.entries.delete(key);
    }

    const bytes = text.length;

    // A single oversized payload must not be able to evict everything
    // else just to be stored and then immediately evicted itself.
    if (bytes > this.options.maxBytes) return;

    this.entries.set(key, { text, etag, storedAt: this.now(), bytes });
    this.bytes += bytes;
    this.enforceLimits();
  }

  /** A 304 means what we hold is still current — restart its clock. */
  touch(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;

    entry.storedAt = this.now();
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  age(entry: CacheEntry): number {
    return this.now() - entry.storedAt;
  }

  invalidatePrefix(prefix: string): void {
    for (const key of [...this.entries.keys()]) {
      if (keyPath(key).startsWith(prefix)) this.drop(key);
    }
  }

  /**
   * Told when a cached body actually CHANGES underneath a screen.
   *
   * The cache exists so navigation paints instantly; the subscription exists
   * so painting instantly never means working from a stale copy. A background
   * revalidation that comes back identical (the common case, answered by a
   * 304) notifies nobody and re-renders nothing.
   */
  private listeners = new Set<(key: string) => void>();

  subscribe(listener: (key: string) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private announce(key: string): void {
    for (const listener of this.listeners) {
      try {
        listener(key);
      } catch {
        /* one bad subscriber must not stop the others */
      }
    }
  }

  /** Replace a body and say so, when the new one is genuinely different. */
  replace(key: string, text: string, etag: string | null): void {
    const before = this.entries.get(key)?.text;
    this.store(key, text, etag);
    if (before !== text) this.announce(key);
  }

  clear(): void {
    this.entries.clear();
    this.bytes = 0;
  }

  /** Drop anything nobody has looked at in a long time. */
  sweep(): void {
    const cutoff = this.now() - this.options.idleEvictMs;
    for (const [key, entry] of [...this.entries.entries()]) {
      if (entry.storedAt < cutoff) this.drop(key);
    }
  }

  stats(): { entries: number; bytes: number } {
    return { entries: this.entries.size, bytes: this.bytes };
  }

  private drop(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;

    this.bytes -= entry.bytes;
    this.entries.delete(key);
  }

  private enforceLimits(): void {
    while (
      this.entries.size > this.options.maxEntries ||
      this.bytes > this.options.maxBytes
    ) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.drop(oldest.value);
    }
  }
}

/** Strip the query string — invalidation works at path granularity. */
export const keyPath = (key: string): string => {
  const q = key.indexOf("?");
  return q === -1 ? key : key.slice(0, q);
};

/**
 * Which paths may be cached, and for how long.
 *
 * Only reference data that a human edits — never anything the floor
 * board, a running session or a cash drawer depends on. TTLs are short on
 * purpose: they are the window in which a change made on ANOTHER machine
 * is invisible here. Changes made on THIS machine are invalidated
 * immediately by the mutation hook below, so the TTL is only about other
 * people's edits, and 30-60 seconds of that is well inside what staff
 * already expect from a multi-user system.
 */
const POLICIES: ReadonlyArray<{ prefix: string; ttlMs: number }> = [
  { prefix: "/tin-rules", ttlMs: 60 * 60 * 1000 },
  { prefix: "/branch-platform-prices", ttlMs: 60_000 },
  { prefix: "/branch-subplatforms", ttlMs: 60_000 },
  { prefix: "/time-packages", ttlMs: 60_000 },
  { prefix: "/products", ttlMs: 60_000 },
  { prefix: "/games", ttlMs: 60_000 },
  { prefix: "/tournaments", ttlMs: 30_000 },
  { prefix: "/branches", ttlMs: 30_000 },
  { prefix: "/places", ttlMs: 20_000 },
];

export const policyFor = (path: string): { ttlMs: number } | null => {
  for (const policy of POLICIES) {
    if (path === policy.prefix || path.startsWith(`${policy.prefix}/`) || path.startsWith(`${policy.prefix}?`)) {
      return { ttlMs: policy.ttlMs };
    }
  }
  return null;
};

/**
 * What a write invalidates.
 *
 * The rule is "its own resource, plus anything whose payload embeds it".
 * Over-invalidating costs one extra request; under-invalidating shows a
 * cashier the price they just changed, unchanged.
 */
const MUTATION_FANOUT: Readonly<Record<string, readonly string[]>> = {
  "/branches": ["/branches", "/places", "/branch-platform-prices", "/branch-subplatforms"],
  "/places": ["/places", "/branches"],
  "/pcs": ["/places", "/branches"],
  "/place-games": ["/places", "/games"],
  "/games": ["/games", "/branches"],
  "/branch-platform-prices": ["/branch-platform-prices", "/places", "/branches"],
  "/branch-subplatforms": ["/branch-subplatforms", "/places", "/branches"],
  "/time-packages": ["/time-packages"],
  "/products": ["/products"],
  "/tournaments": ["/tournaments"],
  "/tournament-registration": ["/tournaments"],
  "/sessions": ["/places", "/branches"],
  "/bookings": ["/places", "/branches"],
  "/translations": ["/products", "/places", "/time-packages", "/games", "/branches"],
};

export const invalidationTargets = (path: string): readonly string[] => {
  const root = `/${path.replace(/^\//, "").split("/")[0] ?? ""}`;
  return MUTATION_FANOUT[root] ?? [root];
};
