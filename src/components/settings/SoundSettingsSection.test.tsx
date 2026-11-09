// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Settings → notification sounds (owner, 2026-11-09: moved from the interface
 * screen), through the REAL preferences provider: a choice is saved at once
 * on its own request, never sending or dropping an unsaved look; a refused
 * save puts the choice back and says so.
 */

vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 3, role: "company_owner" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/sound/soundEngine", () => ({
  setSoundPreferences: () => {}, setDeviceSound: () => {}, isAudioBlocked: () => false, onAudioBlockedChange: () => () => {},
  previewSound: () => {}, soundLengthMs: () => 0, stopPreview: () => {}, unlockAudio: async () => {},
}));
vi.mock("@/infrastructure/KeyValueStore", () => {
  const mem = new Map<string, unknown>();
  return {
    keyValueStore: {
      get: async (k: string) => mem.get(k) ?? null,
      set: async (k: string, v: unknown) => { mem.set(k, v); },
      remove: async (k: string) => { mem.delete(k); },
    },
  };
});
const repo = vi.hoisted(() => ({
  stored: null as unknown,
  put: vi.fn(),
}));
vi.mock("@/repositories/PreferencesRepository", () => ({
  preferencesRepository: {
    get: async () => ({ data: repo.stored, schema_version: 1, onboarding_version: 1, onboarded_at: null }),
    put: (body: unknown) => repo.put(body),
  },
}));

import { UiPreferencesProvider, useUiPreferences } from "@/preferences/UiPreferencesContext";
import SoundSettingsSection from "./SoundSettingsSection";

let api: ReturnType<typeof useUiPreferences> | null = null;
const Grab = () => { api = useUiPreferences(); return null; };

const mount = async () => {
  await act(async () => {
    render(
      <UiPreferencesProvider>
        <Grab />
        <SoundSettingsSection />
      </UiPreferencesProvider>,
    );
  });
  await waitFor(() => expect(api?.loaded).toBe(true));
};

const lastPut = () => repo.put.mock.calls[repo.put.mock.calls.length - 1][0] as { data: Record<string, unknown> };
const rowSwitch = (c: string) => screen.getByTestId(`sound-row-${c}`).querySelector("input") as HTMLInputElement;

beforeEach(() => {
  repo.stored = { interface: "standard", theme: "dark" };
  repo.put.mockReset();
  repo.put.mockImplementation(async (b: { data: unknown }) => ({ data: b.data, schema_version: 1, onboarding_version: 1, onboarded_at: null }));
  api = null;
});
afterEach(cleanup);

describe("Settings → notification sounds", () => {
  test("a choice is saved at once; an unsaved look on the interface screen is neither sent nor dropped", async () => {
    await mount();
    // An unsaved look left on the interface screen.
    await act(async () => { api!.editDraft({ ...api!.prefs, theme: "amber" }); });
    expect(rowSwitch("platform_billing").checked).toBe(true);
    await act(async () => { fireEvent.click(rowSwitch("platform_billing")); });
    await waitFor(() => expect(repo.put).toHaveBeenCalledTimes(1));
    const sent = lastPut().data as { theme: string; sound: { categories: Record<string, { enabled: boolean }> } };
    expect(sent.theme).toBe("dark");
    expect(sent.sound.categories.platform_billing.enabled).toBe(false);
    expect(api!.prefs.sound.categories.platform_billing.enabled).toBe(false);
    expect(api!.draft?.theme).toBe("amber");
  });

  test("a refused save puts the choice back and says so", async () => {
    repo.put.mockRejectedValueOnce(Object.assign(new Error("Server Error"), { status: 500 }));
    await mount();
    await act(async () => { fireEvent.click(rowSwitch("platform_billing")); });
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "appearance.saveFailed");
    expect(rowSwitch("platform_billing").checked).toBe(true);
    expect(api!.prefs.sound.categories.platform_billing.enabled).toBe(true);
  });
});
