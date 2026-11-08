// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Settings → Notifications (owner, 2026-11-09), through the REAL preferences
 * provider: a switch saves the whole document with the block in it; a refusal
 * (an older backend answers 422 to the unknown key) puts the switch back,
 * shows the error, and the next save of the look goes out without the block.
 */

vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 3, role: "company_owner" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/sound/soundEngine", () => ({ setSoundPreferences: () => {}, setDeviceSound: () => {} }));
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
import NotificationSettings from "./NotificationSettings";

let api: ReturnType<typeof useUiPreferences> | null = null;
const Grab = () => { api = useUiPreferences(); return null; };

const mount = async () => {
  await act(async () => {
    render(
      <UiPreferencesProvider>
        <Grab />
        <NotificationSettings />
      </UiPreferencesProvider>,
    );
  });
  await waitFor(() => expect(api?.loaded).toBe(true));
};

const sw = (id: string) => screen.getByTestId(id) as HTMLInputElement;
const lastPut = () => repo.put.mock.calls[repo.put.mock.calls.length - 1][0] as { data: Record<string, unknown> };

beforeEach(() => {
  repo.stored = { interface: "standard", theme: "dark" };
  repo.put.mockReset();
  repo.put.mockImplementation(async (b: { data: unknown }) => ({ data: b.data, schema_version: 1, onboarding_version: 1, onboarded_at: null }));
  api = null;
});
afterEach(cleanup);

describe("Settings → Notifications", () => {
  test("a person with no stored block sees everything on, and the mandatory notices explained", async () => {
    await mount();
    for (const id of ["notif-bookings", "notif-sessions", "notif-support", "notif-system", "notif-platform_billing",
      "notif-platform_billing-email", "notif-platform_billing-telegram"]) {
      expect(sw(id).checked, id).toBe(true);
    }
    expect(screen.getByText("settings.notifications.mandatory")).toBeTruthy();
  });

  test("a switch saves the whole document with the block", async () => {
    await mount();
    await act(async () => { fireEvent.click(sw("notif-bookings")); });
    await waitFor(() => expect(repo.put).toHaveBeenCalledTimes(1));
    const sent = lastPut().data;
    expect(sent.theme).toBe("dark");
    expect(sent.notifications).toEqual({
      categories: {
        bookings: { enabled: false }, sessions: { enabled: true }, support: { enabled: true }, system: { enabled: true },
        platform_billing: { enabled: true, email: true, telegram: true },
      },
    });
    expect(sw("notif-bookings").checked).toBe(false);
    expect(await screen.findByText("settings.notifications.saved")).toBeTruthy();
  });

  test("channels follow platform payments: off disables email and Telegram", async () => {
    await mount();
    await act(async () => { fireEvent.click(sw("notif-platform_billing")); });
    await waitFor(() => expect(repo.put).toHaveBeenCalledTimes(1));
    expect(sw("notif-platform_billing-email").disabled).toBe(true);
    expect(sw("notif-platform_billing-telegram").disabled).toBe(true);
  });

  test("an older backend refuses: the switch goes back, the error shows, the look still saves", async () => {
    repo.put.mockRejectedValueOnce(Object.assign(new Error("The data field must only contain…"), { status: 422 }));
    await mount();
    await act(async () => { fireEvent.click(sw("notif-sessions")); });
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "settings.notifications.saveFailed");
    expect(sw("notif-sessions").checked).toBe(true);
    expect(api!.prefs.notifications).toBeNull();

    // The next save of the look goes out exactly as before the setting existed.
    await act(async () => { await api!.save({ ...api!.prefs, theme: "amber" }); });
    expect(lastPut().data.theme).toBe("amber");
    expect("notifications" in lastPut().data).toBe(false);
  });

  test("a stored block survives a save of the look", async () => {
    repo.stored = { theme: "dark", notifications: { categories: { system: { enabled: false } } } };
    await mount();
    expect(sw("notif-system").checked).toBe(false);
    await act(async () => { await api!.save({ ...api!.prefs, theme: "emerald" }); });
    expect((lastPut().data.notifications as { categories: { system: { enabled: boolean } } }).categories.system.enabled).toBe(false);
  });
});
