// @vitest-environment jsdom
import { Role } from "@/types/api";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Behavioural cover for the startup language flow.
 *
 * The three assertions that actually protect the requirement:
 *
 *  1. a fresh install shows the picker and NOT the login screen behind it;
 *  2. a returning install never sees the picker again (a language chosen once
 *     must stay chosen — re-prompting on every launch is the classic bug here);
 *  3. the picker never renders on stale state — while the async store read is
 *     in flight the app waits, because guessing "not chosen" would re-prompt
 *     every returning user on every launch.
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
  shouldPromptPanelLanguage: vi.fn(async () => false),
  rememberPanelLang: vi.fn(async () => {}),
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
  shouldPromptPanelLanguage: prefs.shouldPromptPanelLanguage,
  rememberPanelLang: prefs.rememberPanelLang,
}));

import { FirstRunLanguageGate, PanelLanguageGate } from "@/i18n/LanguageGates";

const CHILD = <div data-testid="app">app</div>;

/**
 * The picker is found by test id, not by text: it deliberately renders in the
 * HIGHLIGHTED language (live preview), so its copy changes as the user arrows
 * through the list and asserting on it would make these tests about wording.
 */
const pickerShown = (variant: "firstRun" | "workspace") =>
  screen.queryByTestId(`lang-picker-${variant}`) !== null;

const confirm = () => screen.getByTestId("lang-confirm");

beforeEach(() => {
  lang.lang = "en";
  lang.ready = true;
  lang.chosen = true;
  auth.user = null;
  prefs.shouldPromptPanelLanguage.mockResolvedValue(false);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FirstRunLanguageGate", () => {
  test("a fresh install sees the picker and NOT the app behind it", () => {
    lang.chosen = false;
    render(<FirstRunLanguageGate>{CHILD}</FirstRunLanguageGate>);

    expect(pickerShown("firstRun")).toBe(true);
    // The whole point of the requirement: no login form underneath.
    expect(screen.queryByTestId("app")).toBeNull();
  });

  test("a returning install goes straight through", () => {
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

  test("choosing a language commits it", () => {
    lang.chosen = false;
    render(<FirstRunLanguageGate>{CHILD}</FirstRunLanguageGate>);

    fireEvent.click(screen.getByText("Հայերեն"));
    fireEvent.click(confirm());

    expect(lang.setLang).toHaveBeenCalledWith("am");
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

describe("PanelLanguageGate", () => {
  const renderFor = async (role: Role, prompt: boolean) => {
    auth.user = { id: 5, name: "U", email: "u@t.test", role };
    prefs.shouldPromptPanelLanguage.mockResolvedValue(prompt);
    await act(async () => {
      render(<PanelLanguageGate>{CHILD}</PanelLanguageGate>);
    });
  };

  test("an owner is asked before the cabinet is usable", async () => {
    await renderFor("company_owner", true);

    expect(pickerShown("workspace")).toBe(true);
  });

  test("a manager is asked too", async () => {
    await renderFor("manager", true);

    expect(pickerShown("workspace")).toBe(true);
  });

  test("an admin is never asked", async () => {
    await renderFor("admin", false);

    expect(pickerShown("workspace")).toBe(false);
    expect(screen.getByTestId("app")).toBeTruthy();
  });

  test("confirming stores the choice per user and closes the step", async () => {
    await renderFor("company_owner", true);

    // Two separate acts: batching both clicks into one flush would make the
    // confirm read the pre-click selection, which is a test artefact, not the
    // behaviour a user gets.
    await act(async () => { fireEvent.click(screen.getByText("Русский")); });
    await act(async () => { fireEvent.click(confirm()); });

    expect(lang.setLang).toHaveBeenCalledWith("ru");
    expect(prefs.rememberPanelLang).toHaveBeenCalledWith(5, "ru");
    expect(pickerShown("workspace")).toBe(false);
  });

  test("the cabinet is never blocked by an unauthenticated render", async () => {
    // Sign-out unmounts the authed tree; the gate must not hold a dead session.
    auth.user = null;
    await act(async () => {
      render(<PanelLanguageGate>{CHILD}</PanelLanguageGate>);
    });

    expect(screen.getByTestId("app")).toBeTruthy();
    expect(prefs.shouldPromptPanelLanguage).not.toHaveBeenCalled();
  });

  test("the app stays mounted underneath, so nothing refetches after the choice", async () => {
    // The workspace step renders OVER the cabinet rather than replacing it:
    // remounting the tree would throw away every loaded list and re-request it,
    // which is exactly the "reload after choosing a language" this design
    // avoids — all locales are already in the payload.
    await renderFor("manager", true);

    expect(screen.getByTestId("app")).toBeTruthy();
    expect(pickerShown("workspace")).toBe(true);
  });
});
