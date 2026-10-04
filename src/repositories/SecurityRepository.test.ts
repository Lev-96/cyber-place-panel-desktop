import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { validationMessageOf } from "@/api/security";
import { notify, ToastEvent } from "@/ui/notify";

/**
 * The Security repository at the transport: every method's URL, verb, query
 * and body exactly as the 2026-09-29 contract names them (no `/api` prefix),
 * and a toast on every write, success or failure.
 */

interface Call { path: string; method: string; params?: unknown; body?: unknown }
const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; params?: unknown; body?: unknown }>,
  reply: (_c: { path: string; method: string }): Promise<unknown> => Promise.resolve({}),
}));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { method?: string; params?: unknown; body?: unknown } = {}) => {
    const call: Call = { path, method: opts.method ?? "GET", params: opts.params, body: opts.body };
    api.calls.push(call);
    return api.reply(call);
  },
}));

import { securityRepository } from "./SecurityRepository";

let toasts: ToastEvent[] = [];
let unsubscribe = () => {};
beforeEach(() => {
  api.calls = [];
  api.reply = async () => ({});
  toasts = [];
  unsubscribe = notify.subscribe((e) => toasts.push(e));
});
afterEach(() => unsubscribe());

const last = () => api.calls.at(-1);

describe("reads", () => {
  test("the two lists hit their own routes", async () => {
    await securityRepository.blockedIps();
    expect(last()?.path).toBe("/admin/ip-address");
    await securityRepository.blockedCountries();
    expect(last()?.path).toBe("/admin/security/countries");
  });
});

describe("writes", () => {
  test.each([
    ["unblock IP", () => securityRepository.unblockIp(4), "DELETE", "/admin/ip-address/4"],
    ["unblock country", () => securityRepository.unblockCountry(5), "DELETE", "/admin/security/countries/5"],
  ] as const)("%s", async (_name, run, method, path) => {
    await run();
    expect(api.calls).toEqual([{ path, method, params: undefined, body: undefined }]);
    expect(toasts.map((e) => e.kind)).toEqual(["success"]);
  });

  test("block IP / country post the body as given", async () => {
    await securityRepository.blockIp({ ip_address: "2001:db8::/32", note: "range" });
    expect(last()).toMatchObject({ path: "/admin/ip-address", method: "POST", body: { ip_address: "2001:db8::/32", note: "range" } });
    await securityRepository.blockCountry({ country_code: "FR" });
    expect(last()).toMatchObject({ path: "/admin/security/countries", method: "POST", body: { country_code: "FR" } });
  });

  test("a refused write toasts the failure and re-throws for the form", async () => {
    const refusal = Object.assign(new Error("Unprocessable"), { status: 422, body: { errors: { ip_address: ["This rule would block your own address"] } } });
    api.reply = () => Promise.reject(refusal);
    await expect(securityRepository.blockIp({ ip_address: "198.51.100.0/24" })).rejects.toBe(refusal);
    expect(toasts.map((e) => [e.kind, e.action])).toEqual([["error", "created"]]);
  });
});

describe("validationMessageOf", () => {
  const err = (status: number, body: unknown) => Object.assign(new Error("x"), { status, body });

  test("prefers the field's first message", () => {
    expect(validationMessageOf(err(422, { message: "Invalid.", errors: { ip_address: ["Would block you", "b"] } }), "ip_address"))
      .toBe("Would block you");
  });

  test("falls back to the server's message for another field", () => {
    expect(validationMessageOf(err(422, { message: "Invalid.", errors: { note: ["long"] } }), "ip_address")).toBe("Invalid.");
  });

  test("is null for anything that is not a 422", () => {
    expect(validationMessageOf(err(500, { message: "Boom" }), "ip_address")).toBeNull();
    expect(validationMessageOf(new Error("offline"), "ip_address")).toBeNull();
    expect(validationMessageOf(undefined, "ip_address")).toBeNull();
  });
});
