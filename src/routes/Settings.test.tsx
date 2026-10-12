// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * Settings has no "Newsletter" card any more (2026-10-12): it subscribed an
 * email to product updates and is not wanted. Language, currency and the
 * account card stay as they were. The backend `/subscribe` endpoint is
 * untouched — the mobile app still uses it.
 */

const auth = vi.hoisted(() => ({ logout: vi.fn() }));
const lang = vi.hoisted(() => ({ setLang: vi.fn(), setCurrencyOverride: vi.fn() }));
vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, name: "Ann", email: "ann@club.am", role: "manager" }, logout: auth.logout }),
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLang: () => ({ t: (k: string) => k, lang: "en", currency: "AMD", money: (n: number) => String(n), ...lang }),
}));
const request = vi.hoisted(() => vi.fn());
vi.mock("@/api/client", () => ({ request, apiCache: { subscribe: () => () => {} } }));

import Settings from "./Settings";

afterEach(cleanup);

describe("Settings", () => {
  test("has no newsletter card, no email box and sends nothing", () => {
    render(<Settings />);
    expect(screen.queryByText("settings.newsletter")).toBeNull();
    expect(screen.queryByText("settings.subscribeHint")).toBeNull();
    expect(document.querySelector('input[type="email"]')).toBeNull();
    expect(document.querySelector("form")).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  test("language, currency and the account card still work", () => {
    render(<Settings />);
    expect(document.querySelectorAll(".gradient-card")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Русский" }));
    expect(lang.setLang).toHaveBeenCalledWith("ru");
    fireEvent.click(screen.getByRole("button", { name: "USD" }));
    expect(lang.setCurrencyOverride).toHaveBeenCalledWith("USD");
    expect(screen.getByText("ann@club.am")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "nav.signOut" }));
    expect(auth.logout).toHaveBeenCalled();
  });
});
