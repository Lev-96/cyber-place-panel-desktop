// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const store = vi.hoisted(() => ({ removed: [] as string[], meError: null as unknown }));
vi.mock("@/infrastructure/KeyValueStore", () => ({
  keyValueStore: {
    get: async (key: string) => (key === "token" ? "saved-token" : null),
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
const Probe = ({ done }: { done: () => void }) => {
  const { loading } = useAuth();
  if (!loading) done();
  return null;
};

const boot = async () => {
  let finished = false;
  render(<AuthProvider><Probe done={() => { finished = true; }} /></AuthProvider>);
  await waitFor(() => expect(finished).toBe(true));
};

beforeEach(() => { store.removed = []; });
afterEach(() => cleanup());

describe("saved sign-in at start-up", () => {
  test("is kept when the address is blocked", async () => {
    store.meError = Object.assign(new Error("Your IP is blocked."), { status: 403, body: { code: "ip_blocked" } });
    await boot();
    expect(store.removed).toEqual([]);
  });

  test("is dropped for any other failure, as before", async () => {
    store.meError = Object.assign(new Error("Unauthenticated."), { status: 401, body: { message: "Unauthenticated." } });
    await boot();
    expect(store.removed).toEqual(["token", "user"]);
  });
});
