// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const store = vi.hoisted(() => ({ removed: [] as string[], meError: null as unknown, savedUser: null as unknown }));
vi.mock("@/infrastructure/KeyValueStore", () => ({
  keyValueStore: {
    get: async (key: string) => (key === "token" ? "saved-token" : key === "user" ? store.savedUser : null),
    set: async () => {},
    remove: async (key: string) => { store.removed.push(key); },
  },
}));
vi.mock("@/infrastructure/AppConfig", () => ({ AppConfig: { storageKeys: { token: "token", user: "user" } } }));
vi.mock("@/api/auth", () => ({
  apiGetMe: async () => { throw store.meError; },
  apiLogin: async () => ({}),
  apiLogout: async () => {},
}));
vi.mock("@/api/client", () => ({ apiCache: { clear: () => {} } }));
vi.mock("@/realtime/echo", () => ({ disconnectEchoForSignOut: () => {} }));

import { AuthProvider, useAuth } from "./AuthContext";

/**
 * Start-up with a saved sign-in (2026-10-01): a blocked ADDRESS keeps it, so
 * the app continues once the block is lifted; any other failure still drops
 * it, exactly as before.
 */
let signedInAs: unknown = null;
const Probe = ({ done }: { done: () => void }) => {
  const { loading, user } = useAuth();
  if (!loading) { signedInAs = user; done(); }
  return null;
};

const boot = async () => {
  let finished = false;
  render(<AuthProvider><Probe done={() => { finished = true; }} /></AuthProvider>);
  await waitFor(() => expect(finished).toBe(true));
};

beforeEach(() => { store.removed = []; store.savedUser = null; signedInAs = null; });
afterEach(() => cleanup());

describe("saved sign-in at start-up", () => {
  test("is kept when the address is blocked", async () => {
    store.meError = Object.assign(new Error("You have been blocked."), { status: 403, body: { code: "access_blocked" } });
    await boot();
    expect(store.removed).toEqual([]);
  });

  test("is dropped for any other failure, as before", async () => {
    store.meError = Object.assign(new Error("Unauthenticated."), { status: 401, body: { message: "Unauthenticated." } });
    await boot();
    expect(store.removed).toEqual(["token", "user"]);
  });

  test("is dropped when the server refuses the account otherwise (403)", async () => {
    store.meError = Object.assign(new Error("Forbidden."), { status: 403, body: { message: "Forbidden." } });
    await boot();
    expect(store.removed).toEqual(["token", "user"]);
  });
});

/**
 * Start-up while the server cannot be reached (2026-11-02): a venue's internet
 * stalled in the evening, and a panel started then was signed out — and a
 * signed-out panel controls no console. No answer is not a refusal.
 */
describe("saved sign-in when the server gives no verdict", () => {
  const manager = { id: 10, name: "Manager", role: "manager" };

  test("offline: the sign-in is kept and the saved account is used", async () => {
    store.meError = new TypeError("Failed to fetch");
    store.savedUser = manager;
    await boot();
    expect(store.removed).toEqual([]);
    expect(signedInAs).toEqual(manager);
  });

  test("a server error is no verdict either", async () => {
    store.meError = Object.assign(new Error("Server Error"), { status: 502, body: null });
    store.savedUser = manager;
    await boot();
    expect(store.removed).toEqual([]);
    expect(signedInAs).toEqual(manager);
  });

  test("a timeout or rate limit is no verdict either", async () => {
    for (const status of [408, 429]) {
      cleanup();
      store.removed = [];
      store.meError = Object.assign(new Error("Busy"), { status, body: null });
      store.savedUser = manager;
      await boot();
      expect(store.removed).toEqual([]);
    }
  });

  test("offline with nothing saved: the token is kept, and sign-in is asked for", async () => {
    store.meError = new TypeError("Failed to fetch");
    await boot();
    expect(store.removed).toEqual([]);
    expect(signedInAs).toBeNull();
  });
});
