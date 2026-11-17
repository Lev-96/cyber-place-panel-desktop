// @vitest-environment jsdom
import type { AuthUser, Role } from "@/types/api";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * The «Agent updates» badge is the server's `pending_branch_count`, printed as
 * sent (2026-11-17): three pending branches read "3", whatever else the answer
 * says. The admin's «App updates» badge is unchanged: one per app with a
 * release waiting to be promoted.
 */
const auth = vi.hoisted(() => ({ user: null as AuthUser | null }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user, logout: vi.fn() }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));
vi.mock("@/notifications/NotificationsContext", () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
vi.mock("@/support/SupportUnreadContext", () => ({ useSupportUnread: () => ({ unread: 0 }) }));
const updates = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/realtime/UpdatesNotificationContext", () => ({ useUpdatesNotification: () => updates.value }));
vi.mock("@/components/profile/AccountSwitchPanel", () => ({ default: () => null }));
vi.mock("@/components/profile/ProfileModal", () => ({ default: () => null }));
vi.mock("@/components/profile/AccountSwitchModal", () => ({ default: () => null }));

import Sidebar from "./Sidebar";

afterEach(() => cleanup());

const mount = (role: Role) => {
  auth.user = { id: 1, name: "Test User", email: "user@t.test", role, dashboard: { company_id: 4, branch_id: 9 } as AuthUser["dashboard"] };
  render(<MemoryRouter initialEntries={["/"]}><Sidebar /></MemoryRouter>);
};

const badgeOf = (labelKey: string) =>
  screen.getByRole("link", { name: new RegExp(labelKey.replace(".", "\\.")) }).querySelector(".unread-badge")?.textContent ?? null;

describe("the agent updates badge", () => {
  test.each(["company_owner", "manager"] as Role[])("%s: the server's count of pending branches, as sent", (role) => {
    updates.value = {
      panel: null,
      agent: null,
      agentRollout: {
        pending_branch_count: 3,
        // The legacy fields of the same answer say "nothing to do"; the
        // count is what the badge prints.
        has_update: false,
        applied_version: "1.0.27",
        branches: [],
      },
    };
    mount(role);

    expect(badgeOf("nav.agentUpdates")).toBe("3");
  });

  test("no badge when the server counts no pending branch", () => {
    updates.value = { panel: null, agent: null, agentRollout: { pending_branch_count: 0, branches: [] } };
    mount("company_owner");

    expect(badgeOf("nav.agentUpdates")).toBeNull();
  });

  test("admin: one per app with something to promote, as before", () => {
    updates.value = { panel: { has_update: true }, agent: { has_update: true }, agentRollout: null };
    mount("admin");

    expect(badgeOf("nav.updates")).toBe("2");
  });
});
