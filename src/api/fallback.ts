import { ApiError } from "./client";

/**
 * Returns true only when the SERVER answered that the endpoint is not there:
 * 404 or 501. Any other status (a 500, a 422, a 403) is a real failure and is
 * rethrown.
 *
 * An error WITHOUT a status is a request that never got an answer — network
 * down, DNS, CORS, a fetch TypeError. That is NOT a missing endpoint: until
 * 2026-10-07 it was counted as one, so `orFallback` resolved `[]` and a screen
 * that had loaded real data replaced it with "nothing here" the moment the
 * connection dropped (the sessions board said "No devices registered" and the
 * running sessions vanished). Now it rethrows; `useAsync` keeps the data it
 * had and exposes `error`, and the screen says it is offline.
 */
export const isMissingEndpoint = (e: unknown): boolean => {
  const err = e as Partial<ApiError> | null | undefined;
  if (!err || typeof err !== "object") return false;
  // No status = no answer at all: offline, not "missing".
  return err.status === 404 || err.status === 501;
};

/** Returns fallback value when the endpoint is missing; rethrows otherwise. */
export const orFallback = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
  try { return await p; }
  catch (e) { if (isMissingEndpoint(e)) return fallback; throw e; }
};

/** Wraps a CRUD mutation: rewrites missing-endpoint errors into a friendly message. */
export const friendlyMutation = async <T>(p: Promise<T>): Promise<T> => {
  try { return await p; }
  catch (e) {
    if (isMissingEndpoint(e)) {
      throw new Error("Backend endpoint is not deployed yet. Run `php artisan migrate` and deploy the new Laravel files.");
    }
    throw e;
  }
};
