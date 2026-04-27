import { AppConfig } from "@/infrastructure/AppConfig";
import { keyValueStore } from "@/infrastructure/KeyValueStore";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiError extends Error {
  status: number;
  body: unknown;
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
  opts: { method?: Method; body?: unknown; params?: Record<string, unknown> | object } = {},
): Promise<Res> => {
  const token = await keyValueStore.get<string>(AppConfig.storageKeys.token);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${AppConfig.backendUrl}${path}${buildQuery(opts.params)}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body:
      opts.body === undefined
        ? undefined
        : opts.body instanceof FormData
          ? opts.body
          : JSON.stringify(opts.body),
  });

  const text = await res.text();
  const body = text ? safeJson(text) : null;

  if (!res.ok) {
    const err = new Error(extractMessage(body) ?? `HTTP ${res.status}`) as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
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
