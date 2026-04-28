/**
 * Backend response envelope helpers.
 *
 * Laravel responses come in mixed shapes:
 *   - lists wrapped in `{ data: T[] }` (paginator / resource collection)
 *   - singletons wrapped in `{ data: T }` or `{ <entity>: T }` (e.g. `{ company: ... }`)
 *
 * `unwrap()` peels the envelope so api/* layer always returns plain T or T[].
 * Pass a `keyHint` to disambiguate when multiple keys could be present.
 */

export const unwrapList = async <T>(p: Promise<{ data: T[] } | T[]>): Promise<T[]> => {
  const r = await p;
  if (Array.isArray(r)) return r;
  return r.data ?? [];
};

export const unwrapOne = async <T>(p: Promise<unknown>, keyHint?: string): Promise<T> => {
  const r = await p;
  if (r === null || typeof r !== "object") return r as T;
  const obj = r as Record<string, unknown>;
  if (keyHint && obj[keyHint] !== undefined) return obj[keyHint] as T;
  if (obj.data !== undefined) return obj.data as T;
  // Fallback: pick first non-meta key (skip "message", "messages", "meta", "links")
  const skip = new Set(["message", "messages", "meta", "links", "errors", "token"]);
  for (const k of Object.keys(obj)) if (!skip.has(k)) return obj[k] as T;
  return r as T;
};
