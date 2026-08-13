import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same stubs as the other api tests: these cases are about the request the
// website section makes, not about auth or where the backend lives.
vi.mock("@/infrastructure/AppConfig", () => ({
  AppConfig: { backendUrl: "http://backend.test", storageKeys: { token: "token", user: "user" } },
}));
vi.mock("@/infrastructure/KeyValueStore", () => ({
  keyValueStore: { get: async () => "test-token", set: async () => {}, remove: async () => {} },
}));

import { apiMetrikaSummary } from "./metrika";

/**
 * The refresh button's contract with the backend.
 *
 * `?fresh=1` is what tells the server to skip its cached window and re-read
 * Yandex, so it must be sent when — and only when — the operator asked for it.
 * Sending it on every load would put three upstream calls behind every period
 * switch; never sending it would put the section back to showing a cached
 * picture with no way to force it forward.
 */
describe("apiMetrikaSummary", () => {
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

  const calledUrl = (): string => String(fetchMock.mock.calls[0][0]);

  it("asks for the period only on an ordinary load", async () => {
    await apiMetrikaSummary("week");

    expect(calledUrl()).toContain("period=week");
    expect(calledUrl()).not.toContain("fresh");
  });

  it("adds fresh=1 when a refresh was requested", async () => {
    await apiMetrikaSummary("today", true);

    expect(calledUrl()).toContain("period=today");
    expect(calledUrl()).toContain("fresh=1");
  });

  it("omits fresh when it is explicitly false", async () => {
    await apiMetrikaSummary("month", false);

    expect(calledUrl()).not.toContain("fresh");
  });
});
