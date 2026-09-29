// @vitest-environment jsdom
import type { AuthUser } from "@/types/api";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import Sidebar from "./Sidebar";

/**
 * The footer slot (2026-09-29): a shell (the owner web) may add its own entry
 * to the pinned footer. The desktop passes nothing and its footer must stay
 * exactly Support, account card, sign-out.
 */

const auth = vi.hoisted(() => ({ user: null as AuthUser | null }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user, logout: vi.fn() }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/notifications/NotificationsContext", () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
vi.mock("@/realtime/UpdatesNotificationContext", () => ({ useUpdatesNotification: () => ({ panel: null, agent: null }) }));
vi.mock("@/components/profile/AccountSwitchPanel", () => ({ default: () => null }));
vi.mock("@/components/profile/ProfileModal", () => ({ default: () => null }));
vi.mock("@/components/profile/AccountSwitchModal", () => ({ default: () => null }));

const footerOf = (container: HTMLElement) => container.querySelector(".sidebar-footer")!;

afterEach(() => cleanup());

describe("sidebar footer slot", () => {
  test("without it the footer is Support, the account card and sign-out, as before", () => {
    auth.user = { id: 1, name: "O", email: "o@t.test", role: "company_owner" };
    const { container } = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    const children = [...footerOf(container).children];
    expect(children[0].classList.contains("nav-support-card")).toBe(true);
    expect(children[children.length - 1].classList.contains("logout")).toBe(true);
    expect(container.querySelector("[data-test-extra]")).toBeNull();
  });

  test("an extra entry lands after Support and before the account card", () => {
    auth.user = { id: 1, name: "O", email: "o@t.test", role: "company_owner" };
    const { container } = render(
      <MemoryRouter>
        <Sidebar footerExtra={<button data-test-extra>Telegram</button>} />
      </MemoryRouter>,
    );

    const children = [...footerOf(container).children];
    const at = children.findIndex((el) => el.hasAttribute("data-test-extra"));
    expect(at).toBe(1);
    expect(children[0].classList.contains("nav-support-card")).toBe(true);
    expect(children[children.length - 1].classList.contains("logout")).toBe(true);
  });
});
