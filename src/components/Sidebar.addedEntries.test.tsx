// @vitest-environment jsdom
import { can, type Permission } from "@/auth/permissions";
import type { AuthUser, Role } from "@/types/api";
import { cleanup, render, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BRANCH_SECTIONS, branchSectionsFor, branchShortcutId, parseBranchShortcut } from "./branches/branchSections";
import { addedMenuSpecs, iconIdOf, shortcutAllowed } from "./sidebarNav";

/**
 * Branch shortcuts a person switches on in their own menu (2026-11-03): any
 * section of a branch the hub offers that role. Personalisation grants
 * nothing: a shortcut is drawn only for owner / manager, only for a section
 * the role is offered, a manager's only for their own branch, each once.
 */
const auth = vi.hoisted(() => ({ user: null as AuthUser | null }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user, logout: vi.fn() }) }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en"), lang: "en" }) };
});
vi.mock("@/notifications/NotificationsContext", () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
vi.mock("@/support/SupportUnreadContext", () => ({ useSupportUnread: () => ({ unread: 0 }) }));
vi.mock("@/realtime/UpdatesNotificationContext", () => ({ useUpdatesNotification: () => ({ panel: null, agent: null }) }));
vi.mock("@/components/profile/AccountSwitchPanel", () => ({ default: () => null }));
vi.mock("@/components/profile/ProfileModal", () => ({ default: () => null }));
vi.mock("@/components/profile/AccountSwitchModal", () => ({ default: () => null }));
const prefs = vi.hoisted(() => ({ sidebar: [] as Array<{ id: string; hidden: boolean }> }));
vi.mock("@/preferences/UiPreferencesContext", () => ({
  useUiPreferencesOptional: () => ({ layout: { sidebar: prefs.sidebar } }),
}));

import Sidebar from "./Sidebar";

afterEach(() => { cleanup(); prefs.sidebar = []; });

const ROLES: Role[] = ["admin", "company_owner", "manager"];
const on = (id: string) => ({ id, hidden: false });
const mount = (role: Role, sidebar: Array<{ id: string; hidden: boolean }>, at = "/") => {
  auth.user = {
    id: 1, name: "T", email: "t@t.test", role,
    dashboard: { company_id: 4, branch_id: role === "manager" ? 9 : null } as AuthUser["dashboard"],
  };
  prefs.sidebar = sidebar;
  return render(<MemoryRouter initialEntries={[at]}><Sidebar /></MemoryRouter>);
};
const links = () => within(document.querySelector("nav.sidebar-nav") as HTMLElement).getAllByRole("link");
const hrefs = () => links().map((a) => a.getAttribute("href"));
const inBranch = () => hrefs().filter((h) => /^\/branches\/\d+\//.test(h ?? ""));

describe("the catalogue is the hub's, and matches the routes' own guards", () => {
  const app = readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");
  /** The permission guarding `/branches/:branchId/<p>` in App.tsx, or null when unguarded. */
  const guardOf = (p: string): string | null => {
    const at = app.indexOf(`path="/branches/:branchId/${p}"`);
    expect(at, `route for ${p}`).toBeGreaterThan(-1);
    const block = app.slice(at, app.indexOf("<Route", at + 10));
    return /RoleGuard perm="([^"]+)"/.exec(block)?.[1] ?? null;
  };

  test.each(BRANCH_SECTIONS.map((s) => [s.key, s] as const))("%s: offered exactly to the roles its route lets in", (_k, section) => {
    const perm = guardOf(section.path);
    for (const role of ROLES) {
      expect(section.allowed(role), `${section.key} for ${role}`).toBe(perm ? can(role, perm as Permission) : true);
    }
  });

  test("ids name a known section and a real branch, nothing else", () => {
    expect(parseBranchShortcut(branchShortcutId("sessions", 12))).toMatchObject({ branchId: 12, section: { key: "sessions" } });
    for (const bad of ["branch.sessions", "branch.sessions.0", "branch.sessions.-1", "branch.sessions.12x",
      "branch.unknown.12", "branch.Sessions.12", "xbranch.sessions.12", "branch.sessions.12.3", "branch.sessions.12345678901",
      "nav.activePlaces.12"]) {
      expect(parseBranchShortcut(bad), bad).toBeNull();
    }
  });

  test("every section has a drawn icon", () => {
    for (const s of BRANCH_SECTIONS) expect(iconIdOf(branchShortcutId(s.key, 3))).toBe(s.icon);
  });
});

describe("who may have branch shortcuts in their menu", () => {
  test("an owner: Active Places of a branch they picked, straight to its board", () => {
    mount("company_owner", [on("branch.sessions.12")]);
    const link = links().find((a) => a.getAttribute("href") === "/branches/12/sessions") as HTMLElement;
    expect(link.textContent).toContain("Active Places");
    expect(link.querySelector("[data-nav-icon]")?.getAttribute("data-nav-icon")).toBe("branch.sessions");
  });

  test("a manager: every section they are offered, for their own branch", () => {
    const mine = branchSectionsFor("manager").map((s) => on(branchShortcutId(s.key, 9)));
    mount("manager", mine);
    expect(inBranch()).toEqual(branchSectionsFor("manager").map((s) => `/branches/9/${s.path}`));
  });

  test("a manager: never another branch, never a section the hub does not offer them", () => {
    const notOffered = BRANCH_SECTIONS.filter((s) => !s.allowed("manager"));
    expect(notOffered.length).toBeGreaterThan(0); // places, prices, games… are the owner's
    mount("manager", [on("branch.sessions.12"), ...notOffered.map((s) => on(branchShortcutId(s.key, 9)))]);
    expect(inBranch()).toEqual([]);
    expect(shortcutAllowed("manager", 9, "branch.sessions.12")).toBe(false);
  });

  test("an admin is not offered shortcuts, whatever the arrangement says", () => {
    mount("admin", [on("branch.sessions.12"), on("branch.till.12")]);
    expect(inBranch()).toEqual([]);
  });

  test("nobody gets one without switching it on; a hidden or malformed one draws nothing", () => {
    for (const role of ROLES) { mount(role, []); expect(inBranch()).toEqual([]); cleanup(); }
    mount("company_owner", [{ id: "branch.sessions.12", hidden: true }, on("branch.sessions.0"), on("branch.nope.12")]);
    expect(inBranch()).toEqual([]);
  });
});

describe("each once, in the person's order, the rest of the menu untouched", () => {
  test("the same shortcut twice is drawn once", () => {
    const arr = [on("branch.till.12"), on("branch.till.12"), on("branch.sessions.12")];
    expect(addedMenuSpecs("company_owner", null, arr).map((s) => s.id)).toEqual(["branch.till.12", "branch.sessions.12"]);
  });

  test("every standard entry is still there, each once", () => {
    const before = (() => { mount("company_owner", []); const h = hrefs(); cleanup(); return h; })();
    mount("company_owner", [on("branch.sessions.12"), on("branch.till.12")]);
    expect(hrefs().filter((h) => !/^\/branches\/12\//.test(h ?? ""))).toEqual(before);
    expect(new Set(hrefs()).size).toBe(hrefs().length);
  });

  test("placed where the person put them", () => {
    mount("company_owner", [on("branch.till.12"), on("branch.sessions.12"), on("nav.myCompany")]);
    expect(hrefs().slice(0, 3)).toEqual(["/", "/branches/12/pos", "/branches/12/sessions"]);
  });

  test("on the board, Active Places is the current entry; My branch is not lit as well", () => {
    mount("manager", [on("branch.sessions.9")], "/branches/9/sessions");
    const current = links().filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.getAttribute("href"))).toEqual(["/branches/9/sessions"]);
  });
});
