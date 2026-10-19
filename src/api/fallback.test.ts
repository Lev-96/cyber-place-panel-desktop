import { describe, expect, test } from "vitest";
import { friendlyMutation, isMissingEndpoint, orFallback } from "./fallback";

/**
 * Only the server saying "not here" (404 / 501) is a missing endpoint. Until
 * 2026-10-07 an error with NO status (network down) counted too, and
 * `orFallback` turned a dropped connection into an empty list — the sessions
 * board said "No devices registered" and the running sessions vanished.
 */
const apiError = (status: number, body: unknown = null) => Object.assign(new Error(`HTTP ${status}`), { status, body });

describe("isMissingEndpoint", () => {
  test("404 and 501 are a missing endpoint", () => {
    expect(isMissingEndpoint(apiError(404))).toBe(true);
    expect(isMissingEndpoint(apiError(501))).toBe(true);
  });

  test("an error without a status (offline, fetch TypeError, status 0) is NOT", () => {
    expect(isMissingEndpoint(new TypeError("Failed to fetch"))).toBe(false);
    expect(isMissingEndpoint(new Error("network down"))).toBe(false);
    expect(isMissingEndpoint(Object.assign(new Error("x"), { status: 0 }))).toBe(false);
    expect(isMissingEndpoint(null)).toBe(false);
  });

  test("any other status is a real failure, whatever its sentence", () => {
    expect(isMissingEndpoint(apiError(500))).toBe(false);
    expect(isMissingEndpoint(apiError(500, { message: "Route could not be found" }))).toBe(false);
    expect(isMissingEndpoint(apiError(403))).toBe(false);
    expect(isMissingEndpoint(apiError(422))).toBe(false);
  });
});

describe("orFallback", () => {
  test("404 / 501 → the fallback", async () => {
    await expect(orFallback(Promise.reject(apiError(404)), [] as number[])).resolves.toEqual([]);
    await expect(orFallback(Promise.reject(apiError(501)), "default")).resolves.toBe("default");
  });

  test("offline → THROWS (the screen keeps its data and says it is offline)", async () => {
    const e = new TypeError("Failed to fetch");
    await expect(orFallback(Promise.reject(e), [])).rejects.toBe(e);
  });

  test("500 → throws", async () => {
    const e = apiError(500);
    await expect(orFallback(Promise.reject(e), [])).rejects.toBe(e);
  });

  test("success passes through", async () => {
    await expect(orFallback(Promise.resolve([1]), [])).resolves.toEqual([1]);
  });
});

describe("friendlyMutation", () => {
  test("a dropped connection is not reported as «endpoint not deployed»", async () => {
    const e = new TypeError("Failed to fetch");
    await expect(friendlyMutation(Promise.reject(e))).rejects.toBe(e);
  });

  test("a 404 still is", async () => {
    await expect(friendlyMutation(Promise.reject(apiError(404)))).rejects.toThrow(/not deployed/);
  });
});
