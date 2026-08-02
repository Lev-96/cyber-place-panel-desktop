import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * In-memory stand-in for the key-value store. The real one is an IPC bridge
 * under Electron and localStorage on the web build — neither belongs in a unit
 * test, and both are async, which is exactly the property these tests exist to
 * pin down.
 */
const store = vi.hoisted(() => {
  const data = new Map<string, unknown>();
  return {
    data,
    keyValueStore: {
      get: vi.fn(async (k: string) => (data.has(k) ? data.get(k) : null)),
      set: vi.fn(async (k: string, v: unknown) => { data.set(k, v); }),
      remove: vi.fn(async (k: string) => { data.delete(k); }),
    },
  };
});

vi.mock("@/infrastructure/KeyValueStore", () => ({ keyValueStore: store.keyValueStore }));

import {
  getActiveAccount,
  hasAccountLang,
  hasChosenLang,
  notePreLoginChoice,
  readAccountLang,
  readStoredLang,
  rememberAccountLang,
  rememberLang,
  setActiveAccount,
  takePreLoginChoice,
} from "@/i18n/languagePreference";

beforeEach(() => {
  store.data.clear();
  setActiveAccount(null);
  takePreLoginChoice(); // drain any hand-off left by a previous test
});

afterEach(() => vi.clearAllMocks());

describe("device scope — the login screen only", () => {
  test("a fresh install has neither a language nor a choice", async () => {
    expect(await readStoredLang()).toBeNull();
    expect(await hasChosenLang()).toBe(false);
  });

  test("choosing a language records both the value and the fact of choosing", async () => {
    await rememberLang("am");

    expect(await readStoredLang()).toBe("am");
    expect(await hasChosenLang()).toBe(true);
  });

  test("a stored language alone does NOT count as a choice", async () => {
    // The distinction that keeps the pre-login screen honest: if any future
    // code path writes a *default* language, the user must still be asked.
    store.data.set("cp.lang", "ru");

    expect(await readStoredLang()).toBe("ru");
    expect(await hasChosenLang()).toBe(false);
  });

  test("a corrupted stored value degrades to 'never chosen' instead of throwing", async () => {
    store.data.set("cp.lang", "klingon");

    expect(await readStoredLang()).toBeNull();
  });
});

describe("account scope — the source of truth", () => {
  test("an account that has never chosen has nothing stored", async () => {
    expect(await readAccountLang(7)).toBeNull();
    expect(await hasAccountLang(7)).toBe(false);
  });

  test("two accounts on one machine keep separate languages", async () => {
    // The requirement in one test: the preference belongs to the account, not
    // to the device. A shared front-desk PC must not make one person's choice
    // overwrite the other's.
    await rememberAccountLang(7, "ru");
    await rememberAccountLang(9, "am");

    expect(await readAccountLang(7)).toBe("ru");
    expect(await readAccountLang(9)).toBe("am");
  });

  test("while signed in, every language write lands on the account too", async () => {
    // This is what makes a change in Settings persist per account without
    // Settings knowing anything about accounts.
    setActiveAccount(42);
    await rememberLang("am");

    expect(await readAccountLang(42)).toBe("am");
    expect(await readStoredLang()).toBe("am"); // device follows, for the next login screen
  });

  test("while signed out, a write touches the device only", async () => {
    setActiveAccount(null);
    await rememberLang("ru");

    expect(await readStoredLang()).toBe("ru");
    expect(await readAccountLang(42)).toBeNull();
  });

  test("signing out stops writes landing on the account that left", async () => {
    setActiveAccount(42);
    await rememberLang("ru");
    setActiveAccount(null);

    await rememberLang("en");

    expect(await readAccountLang(42)).toBe("ru"); // untouched by the later write
    expect(getActiveAccount()).toBeNull();
  });
});

describe("pre-login hand-off", () => {
  test("the first account to sign in inherits the choice just made", async () => {
    notePreLoginChoice("am");

    expect(takePreLoginChoice()).toBe("am");
  });

  test("it is consumed exactly once", () => {
    // Otherwise a SECOND account signing in later in the same session would
    // silently inherit a language it never chose, and never see the picker.
    notePreLoginChoice("ru");

    expect(takePreLoginChoice()).toBe("ru");
    expect(takePreLoginChoice()).toBeNull();
  });

  test("nothing is inherited when no pre-login choice was made", () => {
    // The returning-launch case: the device already had a language, so the
    // picker never appeared, so an unknown account must still be asked.
    expect(takePreLoginChoice()).toBeNull();
  });

  test("it does not survive an app restart", async () => {
    // In-memory by design. Persisting it would let the device preference stand
    // in for an account's own choice on a later launch.
    notePreLoginChoice("am");
    expect(store.data.has("cp.preLoginChoice")).toBe(false);
    expect([...store.data.keys()].some((k) => k.includes("preLogin"))).toBe(false);
  });
});
