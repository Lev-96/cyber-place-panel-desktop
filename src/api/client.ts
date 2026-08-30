import { AppConfig } from "@/infrastructure/AppConfig";
import { sessionExpiry } from "@/auth/sessionExpiry";
import { keyValueStore } from "@/infrastructure/KeyValueStore";
import { HttpCache, invalidationTargets, policyFor } from "@/api/httpCache";
import { getActiveLang } from "@/i18n/translations";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiError extends Error {
  status: number;
  body: unknown;
}

/**
 * Process-wide response cache. Bounded on both axes so a panel left open
 * for a whole shift cannot grow its memory footprint over time:
 * 300 entries / 8 MB is far more than the reference data the UI actually
 * re-reads, and anything past it evicts the least recently used entry.
 */
export const apiCache = new HttpCache({
  maxEntries: 300,
  maxBytes: 8 * 1024 * 1024,
  idleEvictMs: 10 * 60 * 1000,
});

// Janitor: drop entries nobody has touched in ten minutes. Without it a
// long-lived window keeps paying for screens the user visited once this
// morning. Cheap (a map walk), and rare.
const SWEEP_INTERVAL_MS = 60_000;
if (typeof setInterval === "function") {
  const timer = setInterval(() => apiCache.sweep(), SWEEP_INTERVAL_MS);
  // Node/Electron main-thread safety: never hold the process open just
  // for a cache sweep.
  (timer as unknown as { unref?: () => void }).unref?.();
}

const buildQuery = (params: object | undefined) => {
  if (!params) return "";
  const entries = Object.entries(params as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return `?${qs}`;
};

export const request = async <Res>(
  path: string,
  opts: { method?: Method; body?: unknown; params?: Record<string, unknown> | object; noCache?: boolean } = {},
): Promise<Res> => {
  const method = opts.method ?? "GET";
  const token = await keyValueStore.get<string>(AppConfig.storageKeys.token);
  const headers: Record<string, string> = {
    Accept: "application/json",
    // Bypass ngrok-free.app browser-warning interstitial when backend is tunneled via ngrok.
    // Harmless on any other backend (just an unused header).
    "ngrok-skip-browser-warning": "1",
    // The language the panel is rendering in — NOT the operating system's.
    // The backend writes its own sentences (validation errors, "your branch is
    // blocked") and answers in this language; Chromium's own Accept-Language
    // would otherwise decide it, which is how a Russian panel ends up showing
    // an English refusal.
    "X-App-Language": getActiveLang(),
  };
  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const query = buildQuery(opts.params);
  const cacheKey = `${path}${query}`;
  // Built here rather than below, because the background revalidation on the
  // cache-hit path needs it too.
  const url = `${AppConfig.backendUrl}${path}${query}`;
  const policy = method === "GET" && !opts.noCache ? policyFor(path) : null;
  const cached = policy ? apiCache.lookup(cacheKey) : undefined;

  // Still inside its freshness window: answer from memory, which is what
  // makes tab switching instant — and ask the server anyway, in the
  // background, in case somebody else changed it.
  //
  // Serving the cached copy alone was how an operator ended up working from
  // data that was up to a minute old: a change made by an admin, by another
  // machine or from a phone reached this client only after the TTL expired,
  // because within it no request left at all. Now the screen paints at once
  // and corrects itself a round trip later, and the round trip is a
  // conditional one — an unchanged answer is a 304 of a few dozen bytes that
  // re-renders nothing.
  if (policy && cached && apiCache.age(cached) < policy.ttlMs) {
    void revalidate(cacheKey, url, headers, cached.etag);
    return JSON.parse(cached.text) as Res;
  }

  // Stale but still held: ask the server whether it changed. A 304 is a
  // few dozen bytes and costs the backend nothing but a key lookup.
  if (cached?.etag) {
    headers["If-None-Match"] = cached.etag;
  }

  const res = await fetch(url, {
    method,
    headers,
    body:
      opts.body === undefined
        ? undefined
        : opts.body instanceof FormData
          ? opts.body
          : JSON.stringify(opts.body),
  });

  // Checked before the `res.ok` guard below: 304 is a success for us but
  // not for fetch, which would otherwise turn it into a thrown ApiError.
  if (res.status === 304 && cached) {
    apiCache.touch(cacheKey);
    return JSON.parse(cached.text) as Res;
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;

  if (!res.ok) {
    // A token we sent and the server refused: this session is over — most
    // often because an administrator blocked the company or branch, which
    // revokes the account's tokens. Announced so the auth layer signs out
    // instead of leaving the operator on a screen where every action fails.
    // Only when a token was actually sent: a 401 on an unauthenticated call
    // says nothing about the session.
    if (res.status === 401 && token) {
      sessionExpiry.raise();
    }

    const err = new Error(extractMessage(body) ?? `HTTP ${res.status}`) as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }

  if (policy && typeof body === "object" && body !== null) {
    apiCache.store(cacheKey, text, res.headers.get("ETag"));
  }

  // A write this client just made must be visible on its next read, TTL
  // or no TTL. Done after the response so a failed write leaves the
  // cache alone.
  if (method !== "GET") {
    for (const prefix of invalidationTargets(path)) {
      apiCache.invalidatePrefix(prefix);
    }
  }

  return body as Res;
};

/**
 * A file, fetched the same way as everything else — with the token.
 *
 * Separate from `request` rather than a flag on it: this one never touches the
 * response cache (a cache of file bytes is a memory leak with a nice name),
 * never parses a body, and returns the bytes plus the name the server gave
 * them. Used for support attachments, which have no public URL by design —
 * asking for one without a token is a 401, and asking for someone else's is a
 * 403.
 */
export const requestBlob = async (
  path: string,
): Promise<{ blob: Blob; filename: string | null }> => {
  const token = await keyValueStore.get<string>(AppConfig.storageKeys.token);
  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "1",
    "X-App-Language": getActiveLang(),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${AppConfig.backendUrl}${path}`, { headers });

  if (!res.ok) {
    // Same session rule as `request`: a token the server refused ends the
    // session, and a 401 without one says nothing about it.
    if (res.status === 401 && token) sessionExpiry.raise();
    const text = await res.text();
    const err = new Error(extractMessage(safeJson(text)) ?? `HTTP ${res.status}`) as ApiError;
    err.status = res.status;
    throw err;
  }

  return { blob: await res.blob(), filename: filenameFrom(res.headers.get("Content-Disposition")) };
};

/** The name out of `attachment; filename="..."`, when the server sent one. */
const filenameFrom = (header: string | null): string | null => {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) return decodeURIComponent(utf8[1]);
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
};

/**
 * Ask whether a cached body is still current, without anybody waiting.
 *
 * One flight per key: a screen that mounts three components reading the same
 * endpoint asks once. Failures are swallowed — this is an optimisation of
 * freshness, and a network blip must not turn into an error on a screen that
 * already has its data.
 */
const inFlight = new Set<string>();

const revalidate = async (
  cacheKey: string,
  url: string,
  headers: Record<string, string>,
  etag: string | null,
): Promise<void> => {
  if (inFlight.has(cacheKey)) return;
  inFlight.add(cacheKey);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: etag ? { ...headers, "If-None-Match": etag } : headers,
    });

    if (res.status === 304) {
      apiCache.touch(cacheKey);
      return;
    }
    if (!res.ok) return;

    const text = await res.text();
    // `replace` notifies only when the body actually differs, so an endpoint
    // without ETags does not re-render the screen on every navigation.
    apiCache.replace(cacheKey, text, res.headers.get("ETag"));
  } catch {
    /* offline, or the server hiccuped: the screen keeps what it has */
  } finally {
    inFlight.delete(cacheKey);
  }
};

const safeJson = (s: string): unknown => {
  try { return JSON.parse(s); } catch { return s; }
};

const extractMessage = (b: unknown): string | null => {
  if (!b || typeof b !== "object") return null;
  const m = (b as { message?: unknown }).message;
  if (typeof m === "string") return m;
  return null;
};
