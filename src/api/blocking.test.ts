import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same stubs as the other api tests: these cases are about the request the
// block button makes, not about auth or where the backend lives.
vi.mock("@/infrastructure/AppConfig", () => ({
  AppConfig: { backendUrl: "http://backend.test", storageKeys: { token: "token", user: "user" } },
}));
vi.mock("@/infrastructure/KeyValueStore", () => ({
  keyValueStore: { get: async () => "test-token", set: async () => {}, remove: async () => {} },
}));

import { apiBlock, apiUnblock } from "./blocking";

/**
 * The block is a RESOURCE, not an action: POST creates it, DELETE removes it.
 * That is what makes both calls idempotent server-side, so a double-click
 * cannot produce a second block or a half-applied one — and it is why these
 * tests pin the verb as tightly as the path.
 *
 * The path matters just as much: `/admin/*` IS the authorisation boundary. A
 * call that drifted onto a non-admin path would still work for an admin and
 * silently start working for everyone else.
 */
describe("blocking api", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const call = (): { url: string; method: string } => ({
    url: String(fetchMock.mock.calls[0][0]),
    method: String((fetchMock.mock.calls[0][1] as RequestInit).method),
  });

  it("blocks a company with POST on the admin path", async () => {
    await apiBlock("company", 7);

    expect(call()).toEqual({ url: "http://backend.test/admin/companies/7/block", method: "POST" });
  });

  it("unblocks a company with DELETE on the same path", async () => {
    await apiUnblock("company", 7);

    expect(call()).toEqual({ url: "http://backend.test/admin/companies/7/block", method: "DELETE" });
  });

  it("blocks a branch on the branch path", async () => {
    await apiBlock("branch", 42);

    expect(call()).toEqual({ url: "http://backend.test/admin/branches/42/block", method: "POST" });
  });

  it("unblocks a branch on the branch path", async () => {
    await apiUnblock("branch", 42);

    expect(call()).toEqual({ url: "http://backend.test/admin/branches/42/block", method: "DELETE" });
  });
});
