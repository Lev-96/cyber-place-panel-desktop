import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/AppConfig", () => ({
  AppConfig: { backendUrl: "http://backend.test", storageKeys: { token: "token", user: "user" } },
}));
vi.mock("@/infrastructure/KeyValueStore", () => ({
  keyValueStore: { get: async () => "test-token", set: async () => {}, remove: async () => {} },
}));

import { request } from "./client";
import { setActiveLang } from "@/i18n/translations";

/**
 * The backend writes sentences of its own — validation errors, "your branch is
 * blocked" — and answers in the language the request announces. The panel must
 * announce the language it is RENDERING in, not the one the operating system
 * happens to be in: an Electron window sends Chromium's `Accept-Language` on
 * every request without being asked, which is how a panel switched to Russian
 * still received English refusals.
 */
describe("api client language header", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setActiveLang("en");
  });

  const sentLanguage = (): string =>
    ((fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>)["X-App-Language"];

  it("announces the active language on every request", async () => {
    setActiveLang("ru");
    await request("/whatever", { noCache: true });

    expect(sentLanguage()).toBe("ru");
  });

  it("follows a language change without a reload", async () => {
    setActiveLang("am");
    await request("/whatever", { noCache: true });

    expect(sentLanguage()).toBe("am");
  });

  it("defaults to English when nothing has been chosen", async () => {
    await request("/whatever", { noCache: true });

    expect(sentLanguage()).toBe("en");
  });
});
