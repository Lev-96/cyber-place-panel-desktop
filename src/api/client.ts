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
  const policy = method === "GET" && !opts.noCache ? policyFor(path) : null;
  const cached = policy ? apiCache.lookup(cacheKey) : undefined;

  // Still inside its freshness window: answer without touching the
  // network at all. This is the case that makes tab switching instant.
  if (policy && cached && apiCache.age(cached) < policy.ttlMs) {
    return JSON.parse(cached.text) as Res;
  }

  // Stale but still held: ask the server whether it changed. A 304 is a
  // few dozen bytes and costs the backend nothing but a key lookup.
  if (cached?.etag) {
    headers["If-None-Match"] = cached.etag;
  }

  const url = `${AppConfig.backendUrl}${path}${query}`;
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

const safeJson = (s: string): unknown => {
  try { return JSON.parse(s); } catch { return s; }
};

const extractMessage = (b: unknown): string | null => {
  if (!b || typeof b !== "object") return null;
  const m = (b as { message?: unknown }).message;
  if (typeof m === "string") return m;
  return null;
};
