// @vitest-environment jsdom
import type { AuthUser } from "@/types/api";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Hiding the side menu (2026-11-03): one toggle in the pinned top bar, the
 * state owned by the desktop shell. Hiding it must not touch anything the shell
 * keeps alive — the page, its route, what was typed, the PS5 watcher and the
 * notifiers — and the owner web, which renders the same Sidebar in its own
 * shell, must not change at all.
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

// What the shell keeps alive: each counts its mounts, renders and unmounts.
const life = vi.hoisted(() => ({
  ps5: { mounts: 0, unmounts: 0 },
  notifier: { mounts: 0, renders: 0, unmounts: 0 },
  page: { mounts: 0, renders: 0, unmounts: 0 },
}));
vi.mock("@/ps5/Ps5ControlProvider", async () => {
  const { useEffect } = await import("react");
  return {
    Ps5ControlProvider: ({ children }: { children: React.ReactNode }) => {
      useEffect(() => {
        life.ps5.mounts += 1;
        return () => { life.ps5.unmounts += 1; };
      }, []);
      return <>{children}</>;
    },
  };
});
vi.mock("./notifications/GlobalBookingNotifier", async () => {
  const { useEffect } = await import("react");
  return {
    default: () => {
      life.notifier.renders += 1;
      useEffect(() => {
        life.notifier.mounts += 1;
        return () => { life.notifier.unmounts += 1; };
      }, []);
      return null;
    },
  };
});
vi.mock("./notifications/SupportNotifier", () => ({ default: () => null }));
vi.mock("./notifications/SessionEndingNotifier", () => ({ default: () => null }));
vi.mock("./notifications/BillingNoticeNotifier", () => ({ default: () => null }));
vi.mock("./notifications/ExpenseReminderNotifier", () => ({ default: () => null }));
vi.mock("./ps5/UnexpectedWakeDialog", () => ({ default: () => null }));
vi.mock("./appearance/UnsavedInterfaceNotice", () => ({ default: () => null }));
vi.mock("./appearance/NewInterfacesOffer", () => ({ default: () => null }));

import Layout from "./Layout";
import Sidebar from "./Sidebar";
import PageTopBar from "./ui/PageTopBar";
import { SIDEBAR_ID } from "./SidebarCollapse";

/** A screen with a half-filled form; it reports where it is. */
const Screen = () => {
  const { pathname } = useLocation();
  life.page.renders += 1;
  useEffect(() => {
    life.page.mounts += 1;
    return () => { life.page.unmounts += 1; };
  }, []);
  return (
    <div>
      <h2 className="page-title">Bookings</h2>
      <span data-testid="path">{pathname}</span>
      <input aria-label="guest" />
    </div>
  );
};

beforeEach(() => {
  auth.user = {
    id: 1, name: "Test User", email: "user@t.test", role: "company_owner",
    dashboard: { company_id: 4, branch_id: 9 } as AuthUser["dashboard"],
  };
  for (const k of Object.keys(life) as (keyof typeof life)[]) {
    for (const f of Object.keys(life[k])) (life[k] as Record<string, number>)[f] = 0;
  }
});
afterEach(cleanup);

const mountShell = () =>
  render(
    <MemoryRouter initialEntries={["/bookings"]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/bookings" element={<Screen />} />
          <Route path="/notifications" element={<Screen />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const shell = () => document.querySelector(".app-shell") as HTMLElement;
const aside = () => document.querySelector("aside.sidebar") as HTMLElement;
const toggle = () => screen.getByTestId("sidebar-toggle");
const navLinks = () => Array.from(document.querySelectorAll<HTMLAnchorElement>("nav.sidebar-nav a"));
const supportCard = () => document.querySelector(".nav-support-card") as HTMLElement;

describe("the desktop shell: hide and show the side menu", () => {
  test("opens shown: the toggle says what it would do and points at the menu", () => {
    mountShell();
    expect(shell().classList.contains("app-shell--collapsible")).toBe(true);
    expect(shell().classList.contains("is-sidebar-collapsed")).toBe(false);
    expect(toggle().tagName).toBe("BUTTON");
    expect(toggle().getAttribute("type")).toBe("button");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().getAttribute("aria-controls")).toBe(SIDEBAR_ID);
    expect(toggle().getAttribute("aria-label")).toBe("Side menu");
    expect(toggle().getAttribute("title")).toBe("Collapse menu");
    expect(aside().id).toBe(SIDEBAR_ID);
    expect(aside().hasAttribute("inert")).toBe(false);
    expect(navLinks().every((a) => !a.hasAttribute("title"))).toBe(true);
  });

  test("folds to a rail and back: entries stay reachable, their names move into tooltips", () => {
    mountShell();
    fireEvent.click(toggle());
    expect(shell().classList.contains("is-sidebar-collapsed")).toBe(true);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().getAttribute("title")).toBe("Expand menu");
    // The rail is a working menu, not a hidden one.
    expect(aside().hasAttribute("inert")).toBe(false);
    expect(navLinks().length).toBeGreaterThan(3);
    for (const a of navLinks()) {
      expect(a.getAttribute("title")).toBe(a.querySelector(".nav-label")?.textContent);
    }
    expect(supportCard().getAttribute("title")).toBe("Support");
    // The way back is in the top bar, not in the menu.
    expect(aside().contains(toggle())).toBe(false);

    fireEvent.click(toggle());
    expect(shell().classList.contains("is-sidebar-collapsed")).toBe(false);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().getAttribute("title")).toBe("Collapse menu");
    expect(navLinks().every((a) => !a.hasAttribute("title"))).toBe(true);
    expect(supportCard().hasAttribute("title")).toBe(false);
  });

  test("a rail entry still navigates, and the menu stays folded", () => {
    mountShell();
    fireEvent.click(toggle());
    fireEvent.click(navLinks().find((a) => a.getAttribute("href") === "/notifications") as HTMLElement);
    expect(screen.getByTestId("path").textContent).toBe("/notifications");
    expect(shell().classList.contains("is-sidebar-collapsed")).toBe(true);
  });

  test("repeated presses only ever alternate between the two states", () => {
    mountShell();
    for (let i = 1; i <= 7; i += 1) {
      fireEvent.click(toggle());
      const hidden = i % 2 === 1;
      expect(shell().classList.contains("is-sidebar-collapsed")).toBe(hidden);
      expect(toggle().getAttribute("aria-expanded")).toBe(String(!hidden));
      expect(navLinks()[0].hasAttribute("title")).toBe(hidden);
    }
  });

  test("keyboard focus stays on the toggle both ways", () => {
    mountShell();
    toggle().focus();
    fireEvent.click(toggle());
    expect(document.activeElement).toBe(toggle());
    fireEvent.click(toggle());
    expect(document.activeElement).toBe(toggle());
  });

  test("the page, its route and what was typed survive; nothing the shell keeps alive restarts", () => {
    mountShell();
    const input = screen.getByLabelText("guest") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Aram, 2 pads" } });
    const pageRenders = life.page.renders;
    const notifierRenders = life.notifier.renders;

    fireEvent.click(toggle());
    fireEvent.click(toggle());
    fireEvent.click(toggle());

    expect(screen.getByTestId("path").textContent).toBe("/bookings");
    expect(screen.getByLabelText("guest")).toBe(input);
    expect(input.value).toBe("Aram, 2 pads");
    expect(life.page).toMatchObject({ mounts: 1, unmounts: 0 });
    expect(life.ps5).toEqual({ mounts: 1, unmounts: 0 });
    expect(life.notifier).toMatchObject({ mounts: 1, unmounts: 0 });
    // Not even re-rendered: the shell's state never reaches them.
    expect(life.page.renders).toBe(pageRenders);
    expect(life.notifier.renders).toBe(notifierRenders);
  });

  test("an open account menu closes with the side menu instead of hanging off a hidden card", async () => {
    mountShell();
    fireEvent.click(document.querySelector(".user-card") as HTMLElement);
    expect(document.querySelector(".user-menu-pop")).not.toBeNull();
    await act(async () => { fireEvent.click(toggle()); });
    expect(document.querySelector(".user-menu-pop")).toBeNull();
  });
});

describe("outside the desktop shell (the owner web renders the same Sidebar)", () => {
  test("no toggle in the top bar, and the menu carries no id, no tooltips and is never inert", () => {
    render(
      <MemoryRouter initialEntries={["/bookings"]}>
        <Sidebar />
        <main><PageTopBar /></main>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("sidebar-toggle")).toBeNull();
    expect(aside().hasAttribute("id")).toBe(false);
    expect(aside().hasAttribute("inert")).toBe(false);
    expect(navLinks().every((a) => !a.hasAttribute("title"))).toBe(true);
  });
});

describe("the styles", () => {
  const css = readFileSync(path.resolve(__dirname, "../styles/global.css"), "utf8");

  test("folded, the column is a 64px rail, never zero", () => {
    expect(css).toMatch(/\.app-shell--collapsible\s*\{[^}]*--sidebar-rail-w:\s*64px/);
    expect(css).toMatch(/\.app-shell--collapsible\.is-sidebar-collapsed\s*\{[^}]*grid-template-columns:\s*var\(--sidebar-rail-w\) 1fr/);
    // Nothing moves the menu off screen or stops it painting.
    expect(css).not.toMatch(/is-sidebar-collapsed > \.sidebar\s*\{[^}]*(translateX|visibility)/);
  });

  test("only the desktop shell's own sidebar is reached", () => {
    // The web shell's sidebar sits inside .web-drawer: a descendant selector
    // would reach it, a child selector cannot.
    expect(css).not.toMatch(/\.app-shell--collapsible(\.is-sidebar-collapsed)? \.sidebar/);
  });

  test("every fold transition sits behind prefers-reduced-motion: no-preference", () => {
    const start = css.indexOf("/* The side menu folds to a rail");
    const motion = css.indexOf("@media (prefers-reduced-motion: no-preference) {\n  .app-shell--collapsible {", start);
    expect(start).toBeGreaterThan(-1);
    expect(motion).toBeGreaterThan(start);
    // Between the block's start and its motion query: states only, no transition.
    expect(css.slice(start, motion)).not.toMatch(/transition\s*:/);
    expect(css.slice(motion, motion + 200)).toMatch(/transition: grid-template-columns var\(--sidebar-slide\)/);
  });
});
