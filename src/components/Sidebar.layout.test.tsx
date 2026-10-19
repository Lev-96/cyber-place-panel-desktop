// @vitest-environment jsdom
import type { AuthUser, Role } from "@/types/api";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { activeNavTo } from "./sidebarNav";

/**
 * The sidebar's presentation (2026-10-11): an icon on every entry, exactly ONE
 * current entry for any page, and a footer that ends with the account card
 * carrying the sign-out button on its right.
 */

const auth = vi.hoisted(() => ({ user: null as AuthUser | null, logout: vi.fn() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user, logout: auth.logout }) }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en"), lang: "en" }) };
});
vi.mock("@/notifications/NotificationsContext", () => ({ useNotifications: () => ({ unreadCount: 2 }) }));
vi.mock("@/support/SupportUnreadContext", () => ({ useSupportUnread: () => ({ unread: 0 }) }));
vi.mock("@/realtime/UpdatesNotificationContext", () => ({
  useUpdatesNotification: () => ({ panel: { has_update: true }, agent: { has_update: true } }),
}));
vi.mock("@/components/profile/AccountSwitchPanel", () => ({ default: () => null }));
vi.mock("@/components/profile/ProfileModal", () => ({ default: () => null }));
vi.mock("@/components/profile/AccountSwitchModal", () => ({ default: () => null }));

import Sidebar from "./Sidebar";

afterEach(() => {
  cleanup();
  auth.logout.mockClear();
});

const mount = (role: Role, path = "/") => {
  auth.user = {
    id: 1, name: "Test User", email: "user@t.test", role,
    dashboard: { company_id: 4, branch_id: 9 } as AuthUser["dashboard"],
  };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
};

const nav = () => document.querySelector("nav.sidebar-nav") as HTMLElement;
const links = () => within(nav()).getAllByRole("link");
const current = () => links().filter((a) => a.getAttribute("aria-current") === "page");
const activeClass = () => links().filter((a) => a.classList.contains("active"));

/** The icon id each role's entries must carry, by route (base keys). */
const EXPECTED_ICONS: Record<Role, Record<string, string>> = {
  admin: {
    "/": "nav.dashboard", "/branches": "nav.branches", "/branches-map": "nav.map",
    "/bookings": "nav.bookings", "/bookings/confirm": "nav.scan", "/tournaments": "nav.tournaments",
    "/games": "nav.games", "/companies": "nav.companies", "/revenue": "nav.revenue", "/shifts": "nav.shifts",
    "/expenses": "nav.expenses", "/metrics": "nav.metrics", "/managers": "nav.managers",
    "/owners": "nav.owners", "/security": "nav.security", "/notifications": "nav.notifications",
    "/settings": "nav.settings", "/settings/updates": "nav.updates",
  },
  company_owner: {
    "/": "nav.dashboard", "/companies/4": "nav.myCompany", "/branches": "nav.branches",
    "/managers": "nav.managers", "/revenue": "nav.revenue", "/shifts": "nav.shifts", "/branches-map": "nav.map",
    "/bookings/confirm": "nav.scan", "/bookings": "nav.bookings", "/tournaments": "nav.tournaments",
    "/notifications": "nav.notifications", "/settings": "nav.settings",
    "/settings/agent-updates": "nav.agentUpdates",
  },
  manager: {
    "/": "nav.dashboard", "/branches/9": "nav.myBranch", "/shifts": "nav.shifts", "/bookings/confirm": "nav.scan",
    "/bookings": "nav.bookings", "/tournaments": "nav.tournaments",
    "/notifications": "nav.notifications", "/settings": "nav.settings",
    "/settings/agent-updates": "nav.agentUpdates",
  },
} as Record<Role, Record<string, string>>;

describe("icons", () => {
  test.each(["admin", "company_owner", "manager"] as const)(
    "every %s entry draws the icon of its base key, before the label",
    (role) => {
      mount(role);
      const seen: Record<string, string> = {};
      for (const a of links()) {
        const icon = a.querySelector("svg[data-nav-icon]");
        expect(icon, `icon on ${a.getAttribute("href")}`).not.toBeNull();
        // Before the label, and hidden from the accessible name.
        expect(a.firstElementChild).toBe(icon);
        expect(icon!.getAttribute("aria-hidden")).toBe("true");
        // An icon with no shape would be an empty <svg>.
        expect(icon!.children.length).toBeGreaterThan(0);
        seen[a.getAttribute("href")!] = icon!.getAttribute("data-nav-icon")!;
      }
      expect(seen).toEqual(EXPECTED_ICONS[role]);
    },
  );

  test("the owner's renamed entries keep their base icon (not keyed by the label)", () => {
    mount("company_owner");
    const branches = screen.getByRole("link", { name: "My branches" });
    expect(branches.querySelector("svg")!.getAttribute("data-nav-icon")).toBe("nav.branches");
    const map = screen.getByRole("link", { name: "Branches on the map" });
    expect(map.querySelector("svg")!.getAttribute("data-nav-icon")).toBe("nav.map");
  });

  test("the badge stays after the label", () => {
    mount("company_owner");
    const link = screen.getByRole("link", { name: /Notifications/ });
    expect(link.lastElementChild!.getAttribute("aria-label")).toBe("2 unread");
  });
});

describe("one current entry", () => {
  test.each([
    ["company_owner", "/bookings/confirm", "/bookings/confirm"],
    ["company_owner", "/bookings/5", "/bookings"],
    ["company_owner", "/bookings", "/bookings"],
    ["manager", "/branches/9", "/branches/9"],
    ["manager", "/branches/9/places", "/branches/9"],
    ["admin", "/branches/9", "/branches"],
    ["admin", "/settings/updates", "/settings/updates"],
    ["admin", "/settings", "/settings"],
    ["company_owner", "/companies/4/revenue", "/companies/4"],
    ["company_owner", "/", "/"],
  ] as const)("%s on %s lights only %s", (role, path, expected) => {
    mount(role, path);
    expect(current().map((a) => a.getAttribute("href"))).toEqual([expected]);
    expect(activeClass().map((a) => a.getAttribute("href"))).toEqual([expected]);
  });

  test("the Dashboard is exact-match only: a page outside the menu lights nothing", () => {
    mount("company_owner", "/support");
    expect(current()).toEqual([]);
    expect(activeClass()).toEqual([]);
  });
});

describe("activeNavTo", () => {
  const items = [
    { to: "/", end: true },
    { to: "/bookings" },
    { to: "/bookings/confirm" },
    { to: "/branches" },
    { to: "/branches/9" },
  ];
  test("longest prefix wins; `end` matches exactly; no partial segments", () => {
    expect(activeNavTo(items, "/bookings/confirm")).toBe("/bookings/confirm");
    expect(activeNavTo(items, "/bookings/confirm/")).toBe("/bookings/confirm");
    expect(activeNavTo(items, "/bookings/12")).toBe("/bookings");
    expect(activeNavTo(items, "/branches/9")).toBe("/branches/9");
    expect(activeNavTo(items, "/branches/90")).toBe("/branches");
    expect(activeNavTo(items, "/branches-map")).toBeNull();
    expect(activeNavTo(items, "/")).toBe("/");
    expect(activeNavTo(items, "/nowhere")).toBeNull();
  });
});

describe("footer", () => {
  test("Support first, the account card last, sign-out inside it on the right", () => {
    mount("company_owner");
    const footer = document.querySelector(".sidebar-footer") as HTMLElement;
    const rows = [...footer.children];
    expect(rows[0].classList.contains("nav-support-card")).toBe(true);
    const account = rows[rows.length - 1];
    expect(account.classList.contains("sidebar-account")).toBe(true);
    // Support comes before the account card in the DOM.
    expect(rows[0].compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The card button, then sign-out; nothing after sign-out.
    const signOut = screen.getByRole("button", { name: "Sign out" });
    expect(account.contains(signOut)).toBe(true);
    expect(account.lastElementChild).toBe(signOut);
    expect(account.querySelector(".user-card")!.nextElementSibling).toBe(signOut);
    expect(signOut.getAttribute("title")).toBe("Sign out");
    // Nothing is drawn after the account row anywhere in the sidebar.
    expect(footer.nextElementSibling).toBeNull();
  });

  test("sign-out calls logout once", () => {
    mount("manager");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  test("the account card still opens the account menu", () => {
    mount("company_owner");
    fireEvent.click(document.querySelector(".user-card") as HTMLElement);
    expect(document.querySelector(".user-menu-pop")).not.toBeNull();
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
