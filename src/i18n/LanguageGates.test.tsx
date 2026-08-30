// @vitest-environment jsdom
import { Role } from "@/types/api";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Behavioural cover for the language-selection flow.
 *
 * The whole specification, as tests:
 *
 *   1. first ever launch → picker over the login screen;
 *   2. after signing in, that account is never asked again;
 *   3. sign out and back in to the SAME account → no picker, their language
 *      is applied;
 *   4. sign in as a DIFFERENT account that has never chosen → picker;
 *   5. sign in as a different account that HAS chosen → no picker;
 *   6. the preference belongs to the account, not the machine.
 */

const lang = vi.hoisted(() => ({
  lang: "en" as "en" | "ru" | "am",
  ready: true,
  chosen: true,
  setLang: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  user: null as { id: number; name: string; email: string; role: Role } | null,
}));

const prefs = vi.hoisted(() => ({
  readAccountLang: vi.fn(async (_id: number): Promise<string | null> => null),
  setActiveAccount: vi.fn(),
  notePreLoginChoice: vi.fn(),
  takePreLoginChoice: vi.fn((): string | null => null),
}));

vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({
    lang: lang.lang,
    ready: lang.ready,
    chosen: lang.chosen,
    setLang: lang.setLang,
    currency: "AMD",
    setCurrencyOverride: vi.fn(),
    t: (k: string) => k,
    money: (n: number) => String(n),
  }),
}));

vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));

vi.mock("@/i18n/languagePreference", () => ({
  readAccountLang: prefs.readAccountLang,
  setActiveAccount: prefs.setActiveAccount,
  notePreLoginChoice: prefs.notePreLoginChoice,
  takePreLoginChoice: prefs.takePreLoginChoice,
}));

import { AccountLanguageGate, FirstRunLanguageGate } from "@/i18n/LanguageGates";

const CHILD = <div data-testid="app">app</div>;

/**
 * The picker is found by test id, not by text: it deliberately renders in the
 * HIGHLIGHTED language (live preview), so its copy changes as the user arrows
 * through the list and asserting on it would make these tests about wording.
 */
const pickerShown = (variant: "firstRun" | "account") =>
  screen.queryByTestId(`lang-picker-${variant}`) !== null;

const confirmButton = () => screen.getByTestId("lang-confirm");

beforeEach(() => {
  lang.lang = "en";
  lang.ready = true;
  lang.chosen = true;
  auth.user = null;
  prefs.readAccountLang.mockResolvedValue(null);
  prefs.takePreLoginChoice.mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FirstRunLanguageGate — before anyone signs in", () => {
  test("a fresh install sees the picker over the login screen", () => {
    lang.chosen = false;
    render(<FirstRunLanguageGate>{CHILD}</FirstRunLanguageGate>);

    expect(pickerShown("firstRun")).toBe(true);
    // The login screen is present as context — blurred behind the dialog —
    // rather than absent. A modal over an empty void reads as an error state.
    expect(screen.getByTestId("app")).toBeTruthy();
  });

  test("the login screen behind the picker cannot be reached", () => {
    lang.chosen = false;
    render(<FirstRunLanguageGate>{CHILD}</FirstRunLanguageGate>);

    const backdrop = screen.getByTestId("lang-backdrop");

    // Rendering the form behind the dialog is only acceptable if it is truly
    // unreachable: mouse (CSS pointer-events), keyboard and programmatic focus
    // (inert), and screen readers (aria-hidden).
    expect(backdrop.getAttribute("aria-hidden")).toBe("true");
    expect(backdrop.hasAttribute("inert")).toBe(true);
    expect(backdrop.contains(screen.getByTestId("app"))).toBe(true);
  });

  test("a machine where a language was already chosen goes straight through", () => {
    lang.chosen = true;
    render(<FirstRunLanguageGate>{CHILD}</FirstRunLanguageGate>);

    expect(pickerShown("firstRun")).toBe(false);
    expect(screen.getByTestId("app")).toBeTruthy();
  });

  test("nothing is decided until the stored preference has loaded", () => {
    // Async storage: acting on the default here would re-prompt every returning
    // user on every launch, and flash English at everyone else.
    lang.ready = false;
    lang.chosen = false;
    render(<FirstRunLanguageGate>{CHILD}</FirstRunLanguageGate>);

    expect(pickerShown("firstRun")).toBe(false);
    expect(screen.queryByTestId("app")).toBeNull();
  });

  test("choosing a language commits it and hands it to the first account", () => {
    lang.chosen = false;
    render(<FirstRunLanguageGate>{CHILD}</FirstRunLanguageGate>);

    fireEvent.click(screen.getByText("Հայերեն"));
    fireEvent.click(confirmButton());

    expect(lang.setLang).toHaveBeenCalledWith("am");
    // The hand-off is what stops the account gate asking the same question
    // again two seconds later.
    expect(prefs.notePreLoginChoice).toHaveBeenCalledWith("am");
  });

  test("the picker offers every configured language, by its own name", () => {
    lang.chosen = false;
    render(<FirstRunLanguageGate>{CHILD}</FirstRunLanguageGate>);

    // Endonyms — findable by someone who reads only that script.
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("Русский")).toBeTruthy();
    expect(screen.getByText("Հայերեն")).toBeTruthy();
  });
});

describe("AccountLanguageGate — once per account", () => {
  const signIn = async (id: number, role: Role = "manager") => {
    auth.user = { id, name: "U", email: `u${id}@t.test`, role };
    await act(async () => {
      render(<AccountLanguageGate>{CHILD}</AccountLanguageGate>);
    });
  };

  test("an account that has never chosen is asked", async () => {
    prefs.readAccountLang.mockResolvedValue(null);
    await signIn(5);

    expect(pickerShown("account")).toBe(true);
  });

  test("an account that already chose is never asked, and gets its language", async () => {
    // Sign out and back in to the SAME account: silent, and in their language.
    prefs.readAccountLang.mockResolvedValue("am");
    await signIn(5);

    expect(pickerShown("account")).toBe(false);
    expect(lang.setLang).toHaveBeenCalledWith("am");
    expect(screen.getByTestId("app")).toBeTruthy();
  });

  test("a different account that has never chosen IS asked", async () => {
    // Account 9 signs in on the same machine where account 5 already chose.
    // Reading per account is what makes this correct.
    prefs.readAccountLang.mockImplementation(async (id: number) =>
      (id === 5 ? "ru" : null),
    );
    await signIn(9);

    expect(prefs.readAccountLang).toHaveBeenCalledWith(9);
    expect(pickerShown("account")).toBe(true);
  });

  test("every role is treated the same — including admin", async () => {
    prefs.readAccountLang.mockResolvedValue(null);
    await signIn(11, "admin");

    expect(pickerShown("account")).toBe(true);
  });

  test("confirming stores the choice against the signed-in account", async () => {
    prefs.readAccountLang.mockResolvedValue(null);
    await signIn(5);

    await act(async () => { fireEvent.click(screen.getByText("Русский")); });
    await act(async () => { fireEvent.click(confirmButton()); });

    // setActiveAccount(5) ran first, so setLang persists to the account scope.
    expect(prefs.setActiveAccount).toHaveBeenCalledWith(5);
    expect(lang.setLang).toHaveBeenCalledWith("ru");
    expect(pickerShown("account")).toBe(false);
  });

  test("the first account inherits the pre-login choice instead of being asked twice", async () => {
    // Fresh install: the picker was answered on the login screen seconds ago.
    prefs.readAccountLang.mockResolvedValue(null);
    prefs.takePreLoginChoice.mockReturnValue("am");
    await signIn(5);

    expect(pickerShown("account")).toBe(false);
    expect(lang.setLang).toHaveBeenCalledWith("am");
  });

  test("language writes are attributed to the account, and released on sign-out", async () => {
    prefs.readAccountLang.mockResolvedValue("ru");
    await signIn(5);

    expect(prefs.setActiveAccount).toHaveBeenCalledWith(5);

    cleanup();
    // Unmount = sign-out. A later write must not land on the account that left.
    expect(prefs.setActiveAccount).toHaveBeenLastCalledWith(null);
  });

  test("a signed-out render never blocks the app", async () => {
    auth.user = null;
    await act(async () => {
      render(<AccountLanguageGate>{CHILD}</AccountLanguageGate>);
    });

    expect(screen.getByTestId("app")).toBeTruthy();
    expect(prefs.readAccountLang).not.toHaveBeenCalled();
  });

  test("the cabinet is not rendered in the wrong language while the account loads", async () => {
    // Rendering children before the account preference is read would show the
    // device language and then snap to the account's — a visible flash.
    let resolve: (v: string | null) => void = () => {};
    prefs.readAccountLang.mockReturnValue(new Promise((r) => { resolve = r; }));

    auth.user = { id: 5, name: "U", email: "u@t.test", role: "manager" };
    render(<AccountLanguageGate>{CHILD}</AccountLanguageGate>);

    expect(screen.queryByTestId("app")).toBeNull();

    await act(async () => { resolve("am"); });
    expect(screen.getByTestId("app")).toBeTruthy();
  });

  test("the app stays mounted under the dialog, so nothing refetches", async () => {
    prefs.readAccountLang.mockResolvedValue(null);
    await signIn(5);

    expect(screen.getByTestId("app")).toBeTruthy();
    expect(pickerShown("account")).toBe(true);
    expect(screen.getByTestId("lang-backdrop").hasAttribute("inert")).toBe(true);
  });
});
