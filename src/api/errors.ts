import { ApiError } from "./client";

/**
 * Formats a thrown error from the API client into a multi-line user-readable
 * string. Surfaces Laravel `errors: { field: [msg, ...] }` per field.
 */
export const formatApiError = (e: unknown): string => {
  if (!e) return "Failed";
  const err = e as ApiError;
  const body = (err as ApiError & { body?: unknown }).body;
  if (body && typeof body === "object") {
    const errs = (body as { errors?: unknown }).errors ?? body;
    if (errs && typeof errs === "object") {
      const lines: string[] = [];
      for (const [k, v] of Object.entries(errs as Record<string, unknown>)) {
        if (Array.isArray(v)) lines.push(`${k}: ${v.join("; ")}`);
      }
      if (lines.length) return lines.join("\n");
    }
    const m = (body as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return e instanceof Error ? e.message : "Failed";
};
