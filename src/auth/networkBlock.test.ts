import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/AppConfig", () => ({
  AppConfig: { backendUrl: "http://backend.test", storageKeys: { token: "token", user: "user" } },
}));
vi.mock("@/infrastructure/KeyValueStore", () => ({
  keyValueStore: { get: async () => "test-token", set: async () => {}, remove: async () => {} },
}));

import { apiCache, request, requestBlob } from "@/api/client";
import { isNetworkBlockError, networkBlock, networkBlockCodeOf } from "./networkBlock";

/**
 * An administrator blocked the device's address or country (2026-10-01): the
 * backend answers 403 with `ip_blocked` / `country_blocked` to everything, and
 * the client must say so to the app whichever request noticed first.
 */

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };

describe("networkBlockCodeOf", () => {
  it("recognises exactly the two block codes on a 403", () => {
    expect(networkBlockCodeOf(403, { code: "ip_blocked" })).toBe("ip_blocked");
    expect(networkBlockCodeOf(403, { code: "country_blocked" })).toBe("country_blocked");
    expect(networkBlockCodeOf(401, { code: "ip_blocked" })).toBeNull();
    expect(networkBlockCodeOf(403, { code: "company_blocked" })).toBeNull();
    expect(networkBlockCodeOf(403, { code: "client_route_denied" })).toBeNull();
    expect(networkBlockCodeOf(403, null)).toBeNull();
    expect(networkBlockCodeOf(undefined, { code: "ip_blocked" })).toBeNull();
    expect(isNetworkBlockError(Object.assign(new Error("x"), { status: 403, body: { code: "ip_blocked" } }))).toBe(true);
    expect(isNetworkBlockError(new Error("offline"))).toBe(false);
  });
});

describe("the API client reports a block", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let heard: number;
  let unsubscribe: () => void;

  beforeEach(() => {
    networkBlock.resetForTests();
    apiCache.clear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    heard = 0;
    unsubscribe = networkBlock.subscribe(() => { heard++; });
  });

  afterEach(() => {
    unsubscribe();
    vi.unstubAllGlobals();
    networkBlock.resetForTests();
  });

  it("from a refused request, once however many land", async () => {
    fetchMock.mockImplementation(async () => reply(403, { message: "Your IP is blocked.", code: "ip_blocked" }));

    await expect(request("/user/me")).rejects.toMatchObject({ status: 403 });
    await expect(request("/branches")).rejects.toMatchObject({ status: 403 });

    expect(networkBlock.current()).toBe("ip_blocked");
    expect(heard).toBe(1);
  });

  it("from a file download", async () => {
    fetchMock.mockImplementation(async () => reply(403, { code: "country_blocked" }));
    await expect(requestBlob("/export")).rejects.toMatchObject({ status: 403 });
    expect(networkBlock.current()).toBe("country_blocked");
  });

  it("from the background refresh of a cached screen", async () => {
    fetchMock.mockImplementationOnce(async () => reply(200, { data: [1] }));
    await request("/products");
    fetchMock.mockImplementation(async () => reply(403, { code: "ip_blocked" }));

    await request("/products"); // served from memory, revalidated behind it
    await settle();

    expect(networkBlock.current()).toBe("ip_blocked");
  });

  it("never for any other refusal", async () => {
    fetchMock.mockImplementation(async () => reply(403, { message: "Desktop only", code: "client_route_denied" }));
    await expect(request("/x")).rejects.toMatchObject({ status: 403 });
    fetchMock.mockImplementation(async () => reply(403, { code: "company_blocked" }));
    await expect(request("/y")).rejects.toMatchObject({ status: 403 });

    expect(networkBlock.current()).toBeNull();
    expect(heard).toBe(0);
  });
});
