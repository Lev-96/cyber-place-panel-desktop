import { ApiError } from "./client";

/**
 * Returns true if the error indicates the endpoint is not deployed yet
 * (404 / 501 / no status / network down / Laravel-style "route X could not be found").
 */
export const isMissingEndpoint = (e: unknown): boolean => {
  const err = e as ApiError;
  if (!err) return false;
  if (err.status === 404 || err.status === 501) return true;
  if (!err.status) return true; // network / fetch failure
  const body = err.body;
  if (body && typeof body === "object") {
    const msg = (body as { message?: unknown }).message;
    if (typeof msg === "string" && /could not be found|route .* not found|404/i.test(msg)) return true;
  }
  return false;
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
