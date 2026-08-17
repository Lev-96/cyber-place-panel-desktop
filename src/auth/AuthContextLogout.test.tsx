// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Signing out must revoke the session on the server, not just locally.
 *
 * Sanctum tokens in this backend have no expiry (`config/sanctum.php`), and
 * the panel stores its token on disk. Clearing only the local copy left a
 * lifted token valid indefinitely. `POST /session/logout` deletes every token
 * the user holds, and it already existed — the panel simply never called it.
 *
 * The call is best effort: an operator must be able to sign out while the
 * backend is unreachable, so a failure may not keep them signed in.
 */

const api = vi.hoisted(() => ({
  logout: vi.fn(async () => ({ messages: "ok" })),
  getMe: vi.fn(async () => ({ user: { id: 1, name: "a", email: "a@t.test", role: "admin" } })),
  login: vi.fn(async () => ({ token: "t", user: { id: 1, name: "a", email: "a@t.test", role: "admin" } })),
}));

vi.mock("@/api/auth", () => ({
  apiLogout: api.logout,
  apiGetMe: api.getMe,
  apiLogin: api.login,
}));

const store = vi.hoisted(() => ({
  data: new Map<string, unknown>(),
  get: vi.fn(async (k: string) => store.data.get(k) ?? null),
  set: vi.fn(async (k: string, v: unknown) => { store.data.set(k, v); }),
  remove: vi.fn(async (k: string) => { store.data.delete(k); }),
}));

vi.mock("@/infrastructure/KeyValueStore", () => ({ keyValueStore: store }));
vi.mock("@/api/client", () => ({ apiCache: { clear: vi.fn() } }));
vi.mock("@/auth/recentEmails", () => ({ recentEmails: { remember: vi.fn(async () => {}) } }));

import { AuthProvider, useAuth } from "./AuthContext";
import { AppConfig } from "@/infrastructure/AppConfig";

let auth: ReturnType<typeof useAuth>;

const Probe = () => {
  auth = useAuth();
  return null;
};

const mount = async () => {
  await act(async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
};

describe("AuthContext.logout", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    store.data.clear();
    store.data.set(AppConfig.storageKeys.token, "a-real-token");
    store.data.set(AppConfig.storageKeys.user, { id: 1, name: "a", email: "a@t.test", role: "admin" });
    await mount();
  });

  afterEach(cleanup);

  test("revokes the session on the server", async () => {
    await act(async () => { await auth.logout(); });

    expect(api.logout).toHaveBeenCalledTimes(1);
  });

  test("clears the stored token and user", async () => {
    await act(async () => { await auth.logout(); });

    expect(store.data.has(AppConfig.storageKeys.token)).toBe(false);
    expect(store.data.has(AppConfig.storageKeys.user)).toBe(false);
    expect(auth.user).toBeNull();
  });

  test("revokes BEFORE clearing, so the request still carries the token", async () => {
    let tokenPresentDuringCall: boolean | null = null;
    api.logout.mockImplementationOnce(async () => {
      tokenPresentDuringCall = store.data.has(AppConfig.storageKeys.token);
      return { messages: "ok" };
    });

    await act(async () => { await auth.logout(); });

    expect(tokenPresentDuringCall).toBe(true);
  });

  test("still signs out locally when the backend is unreachable", async () => {
    api.logout.mockRejectedValueOnce(new Error("network down"));

    await act(async () => { await auth.logout(); });

    expect(store.data.has(AppConfig.storageKeys.token)).toBe(false);
    expect(auth.user).toBeNull();
  });

  test("does not reject when the token was already invalid", async () => {
    api.logout.mockRejectedValueOnce({ status: 401, message: "Unauthenticated." });

    await expect(act(async () => { await auth.logout(); })).resolves.not.toThrow();
    expect(auth.user).toBeNull();
  });
});
