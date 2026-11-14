// @vitest-environment jsdom
import type { AuthUser } from "@/types/api";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The app version under the brand (owner, 2026-11-14): a quiet line under the
 * logo and «CYBER PLACE», the full version string, in the desktop app only,
 * ALWAYS in English («Version …») whatever the UI language.
 * The owner web renders this same Sidebar in its drawer; its build carries its
 * own package version (0.1.0), which must never be shown as the panel's.
 */

const PKG_VERSION = (JSON.parse(readFileSync(path.resolve(__dirname, "../../package.json"), "utf8")) as { version: string }).version;

const auth = vi.hoisted(() => ({ user: null as AuthUser | null, logout: vi.fn() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user, logout: auth.logout }) }));
const lang = vi.hoisted(() => ({ code: "en" as "en" | "ru" | "am" }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, lang.code), lang: lang.code }) };
});
vi.mock("@/notifications/NotificationsContext", () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
vi.mock("@/support/SupportUnreadContext", () => ({ useSupportUnread: () => ({ unread: 0 }) }));
vi.mock("@/realtime/UpdatesNotificationContext", () => ({ useUpdatesNotification: () => ({ panel: null, agent: null }) }));
vi.mock("@/components/profile/AccountSwitchPanel", () => ({ default: () => null }));
vi.mock("@/components/profile/ProfileModal", () => ({ default: () => null }));
vi.mock("@/components/profile/AccountSwitchModal", () => ({ default: () => null }));

import Sidebar from "./Sidebar";
import { AppShell, SidebarToggle } from "./SidebarCollapse";

/** The preload's bridge, as the Electron shell exposes it. */
const BRIDGE: NonNullable<Window["desktopAPI"]> = {
  get: async () => null,
  set: async () => {},
  remove: async () => {},
  wakeOnLan: async () => ({ ok: true, mac: "", sent: 0, errors: [], message: "" }),
};

const asDesktopApp = () => {
  window.desktopAPI = BRIDGE;
};

beforeEach(() => {
  lang.code = "en";
  auth.user = { id: 1, name: "Test User", email: "u@t.test", role: "admin", dashboard: { company_id: 4, branch_id: 9 } as AuthUser["dashboard"] };
});
afterEach(() => {
  cleanup();
  delete window.desktopAPI;
  vi.unstubAllGlobals();
});

const mount = (shell = false) => render(
  <MemoryRouter>
    {shell ? <AppShell><SidebarToggle /><Sidebar /></AppShell> : <Sidebar />}
  </MemoryRouter>,
);
const versionLine = () => document.querySelector<HTMLElement>('[data-testid="app-version"]');

describe("in the desktop app", () => {
  beforeEach(() => {
    vi.stubGlobal("__APP_VERSION__", PKG_VERSION);
    asDesktopApp();
  });

  test("the full package.json version, under the brand row and above the menu", () => {
    mount(true);
    const line = versionLine();
    expect(line?.textContent).toBe(`Version ${PKG_VERSION}`);
    const aside = document.querySelector("aside.sidebar") as HTMLElement;
    const order = [...aside.children].map((el) => el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(" ")[0]}` : ""));
    expect(order.slice(0, 3)).toEqual(["h1", "p.sidebar-version", "nav.sidebar-nav"]);
    // The heading is still the brand alone.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("CYBER PLACE");
  });

  test.each(["ru", "am"] as const)("in %s it is still English: «Version …»", (code) => {
    lang.code = code;
    mount(true);
    expect(versionLine()?.textContent).toBe(`Version ${PKG_VERSION}`);
    // Folded, the tooltip says the same words.
    fireEvent.click(screen.getByTestId("sidebar-toggle"));
    expect(screen.getByRole("heading", { level: 1 }).getAttribute("title")).toBe(`Version ${PKG_VERSION}`);
  });

  test("folded to the rail: the line steps aside and the brand's tooltip carries it", async () => {
    mount(true);
    const brand = screen.getByRole("heading", { level: 1 });
    expect(brand.getAttribute("title")).toBeNull();
    expect(versionLine()?.getAttribute("aria-hidden")).toBeNull();

    await act(async () => { fireEvent.click(screen.getByTestId("sidebar-toggle")); });
    expect(brand.getAttribute("title")).toBe(`Version ${PKG_VERSION}`);
    expect(versionLine()?.getAttribute("aria-hidden")).toBe("true");

    await act(async () => { fireEvent.click(screen.getByTestId("sidebar-toggle")); });
    expect(brand.getAttribute("title")).toBeNull();
  });
});

describe("on the web (owner web, a browser tab)", () => {
  test("no version line, even with the web build's own version injected", () => {
    vi.stubGlobal("__APP_VERSION__", "0.1.0");
    mount();
    expect(versionLine()).toBeNull();
    expect(screen.queryByText(/Version/)).toBeNull();
    expect(screen.queryByText(/0\.1\.0/)).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).getAttribute("title")).toBeNull();
  });
});
