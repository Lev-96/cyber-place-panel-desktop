import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/AppConfig", () => ({
  AppConfig: { backendUrl: "http://backend.test", storageKeys: { token: "token", user: "user" } },
}));
vi.mock("@/infrastructure/KeyValueStore", () => ({
  keyValueStore: { get: async () => "test-token", set: async () => {}, remove: async () => {} },
}));

import { request } from "./client";
import { isNetworkBlockError, networkBlock, networkBlockCodeOf } from "@/auth/networkBlock";
import { blockedBodyOf } from "./blockingErrors";

/**
 * An unpaid platform invoice refuses NEW work with 403 and
 * `code: billing_restricted | billing_suspended` (2026-11-09). That refusal is
 * about one action at one branch: it must reach the dialog that made the
 * request as an ordinary error with the server's message — never the
 * whole-app "this device is blocked" screen (`access_blocked` /
 * `access_suspended`), and never the administrative-block wording.
 */
describe("billing refusals do not lock the app", () => {
  const body = (code: string) => ({
    message: "Новые места недоступны: счёт Cyber Place Platform не оплачен.",
    code, scope: "billing", branch_id: 5, company_id: 4,
  });

  beforeEach(() => networkBlock.resetForTests());
  afterEach(() => {
    vi.unstubAllGlobals();
    networkBlock.resetForTests();
  });

  it.each(["billing_restricted", "billing_suspended"])("%s is not an address block", (code) => {
    expect(networkBlockCodeOf(403, body(code))).toBeNull();
    expect(isNetworkBlockError({ status: 403, body: body(code) })).toBe(false);
    expect(blockedBodyOf({ status: 403, body: body(code) })).toBeNull();
  });

  it.each(["billing_restricted", "billing_suspended"])("a %s answer is thrown to the caller and raises nothing", async (code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body(code)), { status: 403, headers: { "Content-Type": "application/json" } }),
    ));
    const raised = vi.fn();
    const off = networkBlock.subscribe(raised);

    const err = await request("/sessions", { method: "POST", body: { pc_id: 1 } }).catch((e: unknown) => e);

    off();
    expect(raised).not.toHaveBeenCalled();
    expect(networkBlock.current()).toBeNull();
    expect(err).toMatchObject({ status: 403, message: body(code).message, body: { code } });
  });

  it("the real address block still raises (the guard is not simply off)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "x", code: "access_blocked" }), { status: 403 }),
    ));
    await request("/sessions", { method: "POST", body: {} }).catch(() => {});
    expect(networkBlock.current()).toBe("blocked");
  });
});

/**
 * The company closed for an unpaid bill (2026-11-09): a sign-in (or any
 * request) refused with `company_billing_blocked` raises the plain Armenian
 * screen — and still never the address block.
 */
describe("the company billing block", () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    networkBlock.resetForTests();
    (await import("@/auth/billingBlock")).billingBlock.dismiss();
  });

  it("raises the billing screen and not the network lock", async () => {
    const { billingBlock } = await import("@/auth/billingBlock");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "…", code: "company_billing_blocked", scope: "billing", company_id: 2 }), { status: 403 }),
    ));
    const err = await request("/session/login", { method: "POST", body: { email: "a@b", password: "x" } }).catch((e: unknown) => e);
    expect(billingBlock.isShown()).toBe(true);
    expect(networkBlock.current()).toBeNull();
    expect(err).toMatchObject({ status: 403, body: { code: "company_billing_blocked" } });
  });

  it("a per-action billing refusal (billing_suspended) does not raise it", async () => {
    const { billingBlock } = await import("@/auth/billingBlock");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "…", code: "billing_suspended", scope: "billing" }), { status: 403 }),
    ));
    await request("/sessions", { method: "POST", body: {} }).catch(() => {});
    expect(billingBlock.isShown()).toBe(false);
  });
});
