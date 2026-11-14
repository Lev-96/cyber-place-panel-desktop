// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SOUND_CATEGORIES, defaultsForRole, DEFAULT_PREFERENCES, ownerDefaultSound } from "./uiPreferences";

/**
 * An owner who never chose sounds hears platform payments only (2026-11-09);
 * anything stored is kept; a manager's defaults do not change.
 */

const auth = vi.hoisted(() => ({ user: { id: 3, role: "company_owner" } as { id: number; role: string } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/sound/soundEngine", () => ({ setSoundPreferences: () => {}, setDeviceSound: () => {} }));
vi.mock("@/infrastructure/KeyValueStore", () => ({
  keyValueStore: { get: async () => null, set: async () => {}, remove: async () => {} },
}));
const repo = vi.hoisted(() => ({ stored: null as unknown }));
vi.mock("@/repositories/PreferencesRepository", () => ({
  preferencesRepository: {
    get: async () => ({ data: repo.stored, schema_version: 1, onboarding_version: 1, onboarded_at: null }),
    put: async (b: { data: unknown }) => ({ data: b.data, schema_version: 1, onboarding_version: 1, onboarded_at: null }),
  },
}));

import { UiPreferencesProvider, useUiPreferences } from "./UiPreferencesContext";

let api: ReturnType<typeof useUiPreferences> | null = null;
const Grab = () => { api = useUiPreferences(); return null; };
const mount = async () => {
  await act(async () => { render(<UiPreferencesProvider><Grab /></UiPreferencesProvider>); });
  await waitFor(() => expect(api?.loaded).toBe(true));
};
const enabled = () => SOUND_CATEGORIES.filter((c) => api!.prefs.sound.categories[c].enabled);

beforeEach(() => { api = null; repo.stored = null; auth.user = { id: 3, role: "company_owner" }; });
afterEach(cleanup);

describe("an owner's sound defaults", () => {
  test("nothing stored: platform payments only", async () => {
    await mount();
    expect(enabled()).toEqual(["platform_billing"]);
  });

  test("a document without sounds (the look saved, sounds never chosen): payments only", async () => {
    repo.stored = { theme: "amber" };
    await mount();
    expect(api!.prefs.theme).toBe("amber");
    expect(enabled()).toEqual(["platform_billing"]);
  });

  test("sounds the owner chose are kept; the new payments sound defaults on", async () => {
    repo.stored = { sound: { profile: "loud", categories: { booking_new: { enabled: true, sound: "bell" } } } };
    await mount();
    expect(api!.prefs.sound.profile).toBe("loud");
    expect(api!.prefs.sound.categories.booking_new).toEqual({ enabled: true, sound: "bell" });
    expect(api!.prefs.sound.categories.platform_billing.enabled).toBe(true);
  });

  test("a manager's defaults are unchanged: every kind on", async () => {
    auth.user = { id: 9, role: "manager" };
    await mount();
    expect(enabled()).toEqual([...SOUND_CATEGORIES]);
  });
});

describe("the helpers", () => {
  test("ownerDefaultSound and defaultsForRole", () => {
    expect(SOUND_CATEGORIES.filter((c) => ownerDefaultSound().categories[c].enabled)).toEqual(["platform_billing"]);
    expect(defaultsForRole(DEFAULT_PREFERENCES, "manager")).toBe(DEFAULT_PREFERENCES);
    expect(defaultsForRole(DEFAULT_PREFERENCES, "company_owner").sound.categories.system.enabled).toBe(false);
  });
});
