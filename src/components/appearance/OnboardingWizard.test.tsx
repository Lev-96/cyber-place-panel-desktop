// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

/**
 * The first-run setup (2026-10-27): shown when the SERVER says a person has
 * not been set up, finished once and for all, skippable, postponable — and
 * never in front of people who already use the panel.
 */
const auth = vi.hoisted(() => ({ user: { id: 3, role: "manager" } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
const repo = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/repositories/PreferencesRepository", () => ({ preferencesRepository: repo }));
const lang = vi.hoisted(() => ({ setLang: vi.fn() }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "ru", setLang: lang.setLang, money: String }) }));
vi.mock("@/sound/soundEngine", async (orig) => ({
  ...(await orig<typeof import("@/sound/soundEngine")>()),
  previewSound: vi.fn(() => () => {}), stopPreview: vi.fn(), unlockAudio: vi.fn(async () => true),
}));

import OnboardingWizard from "./OnboardingWizard";
import NewInterfacesOffer, { offerDismissedKey } from "./NewInterfacesOffer";
import { UiPreferencesProvider } from "@/preferences/UiPreferencesContext";

const doc = (over: object = {}) => ({ data: null, schema_version: 1, onboarding_version: 0, onboarded_at: null, ...over });
const mount = async (path = "/") => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <UiPreferencesProvider><OnboardingWizard /><NewInterfacesOffer /></UiPreferencesProvider>
      </MemoryRouter>,
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const html = () => document.documentElement.dataset;
const press = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); };

beforeEach(() => {
  window.localStorage.clear();
  repo.get.mockReset(); repo.put.mockReset();
  repo.put.mockImplementation(async (b: { data: unknown; onboarding_version?: number }) => doc({ data: b.data, onboarding_version: b.onboarding_version ?? 0 }));
});
afterEach(() => cleanup());

describe("a new person", () => {
  beforeEach(() => repo.get.mockResolvedValue(doc()));

  test("is walked through five steps, each choice shown on the panel at once, and finishes once", async () => {
    await mount();
    expect(screen.getByTestId("onboarding")).toBeTruthy();
    expect(screen.getByText("onboarding.language.title", { selector: "h2" })).toBeTruthy();
    expect(html().density).toBe("simple");

    await press("onboarding.next");
    await act(async () => { fireEvent.click(within(screen.getByTestId("choice-onb-interface-compact")).getByRole("radio")); });
    expect(html().density).toBe("compact");
    await press("onboarding.next");
    await act(async () => { fireEvent.click(within(screen.getByTestId("choice-onb-theme-light")).getByRole("radio")); });
    expect(html().theme).toBe("light");
    await press("onboarding.back");
    expect(screen.getByText("onboarding.interface.title", { selector: "h2" })).toBeTruthy();
    await press("onboarding.next");
    await press("onboarding.next");
    await act(async () => { fireEvent.click(within(screen.getByTestId("choice-onb-sound-loud")).getByRole("radio")); });
    await press("onboarding.next");
    expect(repo.put).not.toHaveBeenCalled();

    await act(async () => { fireEvent.click(screen.getByTestId("onboarding-finish")); });
    expect(repo.put).toHaveBeenCalledTimes(1);
    const sent = repo.put.mock.calls[0][0];
    expect(sent.onboarding_version).toBe(1);
    expect(sent.data).toMatchObject({ interface: "compact", theme: "light", sound: { profile: "loud" } });
    expect(screen.queryByTestId("onboarding")).toBeNull();
    expect(html().theme).toBe("light");
  });

  test("Skip takes the recommended settings and finishes, whatever was picked so far", async () => {
    await mount();
    await press("onboarding.next");
    await act(async () => { fireEvent.click(within(screen.getByTestId("choice-onb-interface-compact")).getByRole("radio")); });
    await press("onboarding.skip");
    expect(repo.put.mock.calls[0][0]).toMatchObject({ onboarding_version: 1, data: { interface: "simple", theme: "dark" } });
    expect(screen.queryByTestId("onboarding")).toBeNull();
  });

  test("Later saves nothing, keeps the safe defaults, and the setup is still due next time", async () => {
    await mount();
    await press("onboarding.next");
    await act(async () => { fireEvent.click(within(screen.getByTestId("choice-onb-interface-compact")).getByRole("radio")); });
    await press("onboarding.later");
    expect(screen.queryByTestId("onboarding")).toBeNull();
    expect(repo.put).not.toHaveBeenCalled();
    expect(html().density).toBe("simple");
    cleanup();
    await mount();
    expect(screen.getByTestId("onboarding")).toBeTruthy();
  });

  test("the language step uses the app's own language switch", async () => {
    await mount();
    await press("English");
    expect(lang.setLang).toHaveBeenCalledWith("en");
  });
});

describe("everybody else", () => {
  test("a person already set up never sees it", async () => {
    repo.get.mockResolvedValue(doc({ onboarding_version: 1 }));
    await mount();
    expect(screen.queryByTestId("onboarding")).toBeNull();
  });

  test("an unreachable server never holds the panel behind it", async () => {
    repo.get.mockRejectedValue(new Error("offline"));
    await mount();
    expect(screen.queryByTestId("onboarding")).toBeNull();
  });
});

describe("the soft offer to people who already use the panel", () => {
  test("shows on the dashboard to someone who never chose, and «Не сейчас» ends it", async () => {
    repo.get.mockResolvedValue(doc({ onboarding_version: 1 }));
    await mount("/");
    expect(screen.getByTestId("new-interfaces-offer")).toBeTruthy();
    await press("appearance.offerLater");
    expect(screen.queryByTestId("new-interfaces-offer")).toBeNull();
    expect(window.localStorage.getItem(offerDismissedKey(3))).toBe("true");
    cleanup();
    await mount("/");
    expect(screen.queryByTestId("new-interfaces-offer")).toBeNull();
  });

  test("not to someone who saved their own, not off the dashboard, not during setup", async () => {
    repo.get.mockResolvedValue(doc({ onboarding_version: 1, data: { theme: "light" } }));
    await mount("/");
    expect(screen.queryByTestId("new-interfaces-offer")).toBeNull();
    cleanup();
    repo.get.mockResolvedValue(doc({ onboarding_version: 1 }));
    await mount("/bookings");
    expect(screen.queryByTestId("new-interfaces-offer")).toBeNull();
    cleanup();
    repo.get.mockResolvedValue(doc());
    await mount("/");
    expect(screen.queryByTestId("new-interfaces-offer")).toBeNull();
  });
});
