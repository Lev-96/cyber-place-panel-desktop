// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_PREFERENCES, ONBOARDING_VERSION, PRESETS } from "./uiPreferences";

/**
 * The person's interface applied to the document (2026-10-27): the server is
 * the source, a local copy only speeds up the first frame, and a failure
 * never blocks the till.
 */
const auth = vi.hoisted(() => ({ user: { id: 7 } as { id: number } | null }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
const repo = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/repositories/PreferencesRepository", () => ({ preferencesRepository: repo }));

import { UiPreferencesProvider, cacheKey, onboardedKey, useUiPreferences } from "./UiPreferencesContext";

let state: ReturnType<typeof useUiPreferences>;
const Probe = () => { state = useUiPreferences(); return null; };
const mount = async () => {
  await act(async () => { render(<UiPreferencesProvider><Probe /></UiPreferencesProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const html = () => document.documentElement.dataset;
const doc = (over: object = {}) => ({ data: null, schema_version: 1, onboarding_version: 1, onboarded_at: null, ...over });

beforeEach(() => {
  window.localStorage.clear();
  auth.user = { id: 7 };
  repo.get.mockReset(); repo.put.mockReset();
  repo.put.mockImplementation(async (b: { data: unknown; onboarding_version?: number }) =>
    doc({ data: b.data, onboarding_version: b.onboarding_version ?? 1 }));
});
afterEach(() => cleanup());

describe("UiPreferencesProvider", () => {
  test("a person already here gets the standard interface and no setup", async () => {
    repo.get.mockResolvedValue(doc());
    await mount();
    expect(state.prefs).toEqual(DEFAULT_PREFERENCES);
    expect(state.needsOnboarding).toBe(false);
    expect(html().theme).toBe("dark");
    expect(html().density).toBe("standard");
  });

  test("a new person is due the setup, offered the simple interface", async () => {
    repo.get.mockResolvedValue(doc({ onboarding_version: 0 }));
    await mount();
    expect(state.needsOnboarding).toBe(true);
    expect(state.prefs.interface).toBe("simple");
  });

  test("the saved interface is applied to the document", async () => {
    repo.get.mockResolvedValue(doc({ data: { interface: "compact", theme: "light" } }));
    await mount();
    expect(html().theme).toBe("light");
    expect(html().density).toBe("compact");
    expect(html().cardSize).toBe(PRESETS.compact.card_size);
    expect(html().quickActions).toBe("all");
  });

  test("offline: the local copy stands and no setup is forced", async () => {
    window.localStorage.setItem(cacheKey(7), JSON.stringify({ interface: "simple", theme: "contrast" }));
    repo.get.mockRejectedValue(new Error("offline"));
    await mount();
    expect(state.prefs.theme).toBe("contrast");
    expect(state.needsOnboarding).toBe(false);
    expect(html().theme).toBe("contrast");
  });

  test("a preview shows without saving, and cancelling puts the saved one back", async () => {
    repo.get.mockResolvedValue(doc());
    await mount();
    await act(async () => { state.preview({ ...DEFAULT_PREFERENCES, theme: "light" }); });
    expect(html().theme).toBe("light");
    expect(repo.put).not.toHaveBeenCalled();
    await act(async () => { state.preview(null); });
    expect(html().theme).toBe("dark");
  });

  test("saving writes the document, the local copy and the screen", async () => {
    repo.get.mockResolvedValue(doc());
    await mount();
    await act(async () => { await state.save({ ...DEFAULT_PREFERENCES, theme: "light" }); });
    expect(repo.put).toHaveBeenCalledWith(expect.objectContaining({ schema_version: 1, data: expect.objectContaining({ theme: "light" }) }));
    expect(repo.put.mock.calls[0][0]).not.toHaveProperty("onboarding_version");
    expect(JSON.parse(window.localStorage.getItem(cacheKey(7))!).theme).toBe("light");
    expect(html().theme).toBe("light");
  });

  test("a failed save keeps the choice on screen and says so", async () => {
    repo.get.mockResolvedValue(doc());
    repo.put.mockRejectedValue(new Error("offline"));
    await mount();
    await act(async () => { await state.save({ ...DEFAULT_PREFERENCES, theme: "light" }).catch(() => {}); });
    expect(state.saveFailed).toBe(true);
    expect(html().theme).toBe("light");
  });

  test("finishing the setup reports its version and is not shown again", async () => {
    repo.get.mockResolvedValue(doc({ onboarding_version: 0 }));
    await mount();
    await act(async () => { await state.finishOnboarding(state.prefs); });
    expect(repo.put.mock.calls[0][0].onboarding_version).toBe(ONBOARDING_VERSION);
    expect(state.needsOnboarding).toBe(false);
  });

  test("another person on the same machine never inherits the first one's interface", async () => {
    repo.get.mockResolvedValue(doc({ data: { theme: "light" } }));
    await mount();
    expect(html().theme).toBe("light");
    cleanup();
    auth.user = { id: 8 };
    repo.get.mockResolvedValue(doc());
    await mount();
    expect(state.prefs.theme).toBe("dark");
    expect(html().theme).toBe("dark");
  });
});

/**
 * A setup finished while the server could not be told (review, 2026-10-27):
 * not asked again, and the server is told with the next save or sign-in.
 */
describe("finishing the setup offline", () => {
  test("the next save carries it, and the setup does not come back", async () => {
    repo.get.mockResolvedValue(doc({ onboarding_version: 0 }));
    repo.put.mockRejectedValueOnce(new Error("offline"));
    await mount();
    await act(async () => { await state.finishOnboarding(state.prefs).catch(() => {}); });
    expect(state.needsOnboarding).toBe(false);

    repo.put.mockImplementation(async (b: { data: unknown; onboarding_version?: number }) =>
      doc({ data: b.data, onboarding_version: b.onboarding_version ?? 0 }));
    await act(async () => { await state.save({ ...DEFAULT_PREFERENCES, theme: "light" }); });
    expect(repo.put.mock.calls.at(-1)![0].onboarding_version).toBe(ONBOARDING_VERSION);
    expect(state.needsOnboarding).toBe(false);
  });

  test("the next sign-in tells the server by itself and does not show the setup", async () => {
    window.localStorage.setItem(onboardedKey(7), JSON.stringify(ONBOARDING_VERSION));
    repo.get.mockResolvedValue(doc({ onboarding_version: 0 }));
    await mount();
    expect(state.needsOnboarding).toBe(false);
    expect(repo.put).toHaveBeenCalledWith({ schema_version: 1, data: null, onboarding_version: ONBOARDING_VERSION });
  });

  test("a person who never finished on this computer is still asked", async () => {
    repo.get.mockResolvedValue(doc({ onboarding_version: 0 }));
    await mount();
    expect(state.needsOnboarding).toBe(true);
    expect(repo.put).not.toHaveBeenCalled();
  });
});
