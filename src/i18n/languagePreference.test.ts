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
  PANEL_LANGUAGE_PROMPT,
  hasChosenLang,
  readPanelLang,
  readStoredLang,
  rememberLang,
  rememberPanelLang,
  roleNeedsPanelLanguage,
  shouldPromptPanelLanguage,
} from "@/i18n/languagePreference";

beforeEach(() => store.data.clear());
afterEach(() => vi.clearAllMocks());

describe("first-run detection", () => {
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
    // The distinction that keeps the first-run screen honest: if any future
    // code path writes a *default* language, the user must still be asked.
    store.data.set("cp.lang", "ru");

    expect(await readStoredLang()).toBe("ru");
    expect(await hasChosenLang()).toBe(false);
  });

  test("a corrupted stored value degrades to 'never chosen' instead of throwing", async () => {
    // A bad value must not break startup — the gate simply asks again.
    store.data.set("cp.lang", "klingon");

    expect(await readStoredLang()).toBeNull();
  });
});

describe("workspace language is per user", () => {
  test("two accounts on one machine keep separate choices", async () => {
    // The shared front-desk case: a Russian-speaking manager on one shift, an
    // Armenian-speaking owner on the next.
    await rememberPanelLang(7, "ru");
    await rememberPanelLang(9, "am");

    expect(await readPanelLang(7)).toBe("ru");
    expect(await readPanelLang(9)).toBe("am");
  });

  test("confirming a workspace language also becomes the app language", async () => {
    // One active language, not two competing ones — otherwise signing out would
    // snap the UI back to a different language than the one just confirmed.
    await rememberPanelLang(7, "am");

    expect(await readStoredLang()).toBe("am");
    expect(await hasChosenLang()).toBe(true);
  });

  test("an unknown user id simply has no stored choice", async () => {
    expect(await readPanelLang(1234)).toBeNull();
  });
});

describe("who gets asked", () => {
  test("owner and manager do; admin does not", () => {
    expect(roleNeedsPanelLanguage("company_owner")).toBe(true);
    expect(roleNeedsPanelLanguage("manager")).toBe(true);
    expect(roleNeedsPanelLanguage("admin")).toBe(false);
    expect(roleNeedsPanelLanguage(undefined)).toBe(false);
  });

  test("an admin is never prompted, whatever the policy", async () => {
    expect(await shouldPromptPanelLanguage("admin", 1)).toBe(false);
  });

  test("policy decides whether a returning owner is asked again", async () => {
    await rememberPanelLang(1, "ru");

    // Asserted against the constant rather than hard-coded, so flipping the
    // policy flips this expectation instead of breaking the suite — the
    // behaviour is a product decision, not an invariant.
    expect(await shouldPromptPanelLanguage("company_owner", 1))
      .toBe(PANEL_LANGUAGE_PROMPT === "always");
  });

  test("an owner who has never chosen is always prompted", async () => {
    expect(await shouldPromptPanelLanguage("company_owner", 42)).toBe(true);
  });
});
