// @vitest-environment jsdom
import type { AuthUser, Role } from "@/types/api";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { t } from "@/i18n/translations";
import { sortedNavItems } from "./sidebarNav";

/**
 * The side menu in alphabetical order of its labels, in the language on
 * screen (2026-10-07) — with the real translations, for every role. Armenian
 * must follow the Armenian alphabet (the panel's `am` is Amharic to `Intl`,
 * so a wrong mapping would sort it by code point).
 *
 * The Dashboard is pinned first whatever the language (2026-10-09): sorted by
 * its label it landed under П in Russian and Կ in Armenian. Only the entries
 * after it are alphabetical.
 */

const auth = vi.hoisted(() => ({ user: null as AuthUser | null }));
const lang = vi.hoisted(() => ({ current: "en" as "en" | "ru" | "am" }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user, logout: vi.fn() }) }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, lang.current), lang: lang.current }) };
});
vi.mock("@/notifications/NotificationsContext", () => ({ useNotifications: () => ({ unreadCount: 3 }) }));
vi.mock("@/support/SupportUnreadContext", () => ({ useSupportUnread: () => ({ unread: 0 }) }));
vi.mock("@/realtime/UpdatesNotificationContext", () => ({ useUpdatesNotification: () => ({ panel: null, agent: null }) }));
vi.mock("@/components/profile/AccountSwitchPanel", () => ({ default: () => null }));
vi.mock("@/components/profile/ProfileModal", () => ({ default: () => null }));
vi.mock("@/components/profile/AccountSwitchModal", () => ({ default: () => null }));

import Sidebar from "./Sidebar";

afterEach(() => cleanup());

const mount = (role: Role) => {
  auth.user = { id: 1, name: "Test User", email: "user@t.test", role, dashboard: { company_id: 4, branch_id: 9 } as AuthUser["dashboard"] };
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Sidebar />
    </MemoryRouter>,
  );
};

/** The visible names of the menu entries, top to bottom (badges stripped). */
const menuNames = () =>
  within(document.querySelector("nav.sidebar-nav") as HTMLElement)
    .getAllByRole("link")
    .map((a) => (a.querySelector(".nav-label")?.textContent ?? "").trim());

const firstLink = () =>
  within(document.querySelector("nav.sidebar-nav") as HTMLElement).getAllByRole("link")[0];

const collated = (names: string[], tag: string) =>
  [...names].sort(new Intl.Collator(tag, { sensitivity: "base", numeric: true }).compare);

/**
 * The owner's and the manager's menu (2026-10-11): an explicit order by the
 * entries' stable keys — the same in every language — with menu-only wording;
 * whatever is not in that list (Settings, Agent updates) follows
 * alphabetically. Admin keeps Dashboard first + alphabetical.
 */
const STAFF_ORDER = {
  company_owner: [
    "nav.dashboard", "nav.myCompany", "nav.side.myBranches", "nav.side.myManagers", "nav.revenue",
    "nav.side.branchesOnMap", "nav.side.scanCode", "nav.bookings", "nav.side.allTournaments", "nav.notifications",
  ],
  manager: [
    "nav.dashboard", "nav.myBranch", "nav.side.scanCode", "nav.bookings", "nav.side.myBranchTournaments", "nav.notifications",
  ],
} as const;

describe.each([
  ["en", "en"],
  ["ru", "ru"],
  ["am", "hy"],
] as const)("in %s", (code, tag) => {
  test("the admin menu: Dashboard first, the rest in alphabetical order", () => {
    lang.current = code;
    mount("admin");
    const names = menuNames();
    const [first, ...rest] = names;
    expect(names.length).toBeGreaterThan(5);
    expect(first).toBe(t("nav.dashboard", code));
    expect(firstLink().getAttribute("href")).toBe("/");
    expect(rest).toEqual(collated(rest, tag));
    expect(new Set(names).size).toBe(names.length);
    // Admin sees every branch and manager: never "My …".
    expect(names).toContain(t("nav.branches", code));
    expect(names).not.toContain(t("nav.side.myBranches", code));
  });

  test.each(["company_owner", "manager"] as const)("the %s menu: the explicit order, then the rest alphabetically", (role) => {
    lang.current = code;
    mount(role);
    const names = menuNames();
    const head = STAFF_ORDER[role].map((key) => t(key, code));
    expect(names.slice(0, head.length)).toEqual(head);
    expect(firstLink().getAttribute("href")).toBe("/");
    const tail = names.slice(head.length);
    expect(tail.length).toBeGreaterThan(0);
    expect(tail).toEqual(collated(tail, tag));
    expect(new Set(names).size).toBe(names.length);
  });
});

test("a manager reads their own branch's tournaments, not all branches'", () => {
  lang.current = "ru";
  mount("manager");
  const names = menuNames();
  expect(names).toContain("Турниры моего филиала");
  expect(names).not.toContain("Турниры филиалов");
  // A manager has no branches list, managers, revenue or map.
  for (const key of ["nav.side.myBranches", "nav.side.myManagers", "nav.revenue", "nav.side.branchesOnMap"]) {
    expect(names).not.toContain(t(key, "ru"));
  }
});

test("the owner's menu wording in Russian, as asked", () => {
  lang.current = "ru";
  mount("company_owner");
  expect(menuNames().slice(0, 10)).toEqual([
    "Панель", "Моя компания", "Мои филиалы", "Мои менеджеры", "Выручка",
    "Филиалы на карте", "Сканировать код", "Бронирования", "Турниры филиалов", "Уведомления",
  ]);
});

test("the manager's menu wording in Russian, as asked", () => {
  lang.current = "ru";
  mount("manager");
  expect(menuNames().slice(0, 6)).toEqual([
    "Панель", "Мой филиал", "Сканировать код", "Бронирования", "Турниры моего филиала", "Уведомления",
  ]);
});

test("the map entry's wording in every language", () => {
  expect(t("nav.side.branchesOnMap", "ru")).toBe("Филиалы на карте");
  expect(t("nav.side.branchesOnMap", "en")).toBe("Branches on the map");
  expect(t("nav.side.branchesOnMap", "am")).toBe("Մասնաճյուղերը քարտեզի վրա");
});

test("switching the language keeps the owner's order", () => {
  lang.current = "en";
  const { rerender } = mount("company_owner");
  const en = menuNames();
  for (const code of ["ru", "am"] as const) {
    lang.current = code;
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <Sidebar />
      </MemoryRouter>,
    );
    const now = menuNames();
    expect(now.slice(0, 10)).toEqual(STAFF_ORDER.company_owner.map((key) => t(key, code)));
    expect(now).toHaveLength(en.length);
  }
});

test("Russian admin menu: Безопасность, then Бронирования, then Выручка, under the pinned Панель", () => {
  lang.current = "ru";
  mount("admin");
  const names = menuNames();
  expect(names[0]).toBe("Панель");
  const at = (name: string) => names.indexOf(name);
  expect(at("Безопасность")).toBeGreaterThan(0);
  expect(at("Безопасность")).toBeLessThan(at("Бронирования"));
  expect(at("Бронирования")).toBeLessThan(at("Выручка"));
});

test("the role decides the entries, the pin does not: same set as the role's permissions", () => {
  lang.current = "en";
  mount("manager");
  const hrefs = within(document.querySelector("nav.sidebar-nav") as HTMLElement)
    .getAllByRole("link").map((a) => a.getAttribute("href"));
  expect(hrefs[0]).toBe("/");
  expect(hrefs).not.toContain("/security");
  expect(hrefs).not.toContain("/owners");
  expect(hrefs).toContain("/branches/9");
  cleanup();
  mount("admin");
  const adminHrefs = within(document.querySelector("nav.sidebar-nav") as HTMLElement)
    .getAllByRole("link").map((a) => a.getAttribute("href"));
  expect(adminHrefs[0]).toBe("/");
  expect(adminHrefs).toContain("/security");
  expect(adminHrefs).toContain("/owners");
});

test("Armenian follows the Armenian alphabet, not character codes", () => {
  lang.current = "am";
  mount("admin");
  const names = menuNames();
  // Ա (Ամրագրումներ) comes before Ք (Քարտեզ); Ե before Կ; Մ before Ս.
  const at = (prefix: string) => names.findIndex((n) => n.startsWith(prefix));
  expect(at("Ամրագրումներ")).toBeLessThan(at("Քարտեզ"));
  expect(at("Եկամուտ")).toBeLessThan(at("Կարգավորումներ"));
  expect(at("Մասնաճյուղեր")).toBeLessThan(at("Սեփականատերեր"));
});

test("every entry keeps its own link and badge after sorting", () => {
  lang.current = "en";
  mount("company_owner");
  const notifications = screen.getByRole("link", { name: /Notifications/ });
  expect(notifications.getAttribute("href")).toBe("/notifications");
  expect(within(notifications).getByLabelText("3 unread")).toBeTruthy();
  expect(screen.getByRole("link", { name: "My company" }).getAttribute("href")).toBe("/companies/4");
});

test("the footer is not part of the sorted menu", () => {
  lang.current = "en";
  mount("company_owner");
  const footer = document.querySelector(".sidebar-footer") as HTMLElement;
  expect(footer.firstElementChild?.classList.contains("nav-support-card")).toBe(true);
  expect(footer.lastElementChild?.classList.contains("sidebar-account")).toBe(true);
});

describe("sortedNavItems", () => {
  const t = (k: string) => ({ a: "Beta", b: "alpha", c: "Beta", d: "Gamma" })[k] ?? k;

  test("keeps only what the role may open and sorts case-insensitively", () => {
    const items = sortedNavItems(
      [
        { to: "/d", labelKey: "d", show: true },
        { to: "/b", labelKey: "b", show: true },
        { to: "/x", labelKey: "x", show: false },
      ],
      t,
      "en",
    );
    expect(items.map((i) => i.to)).toEqual(["/b", "/d"]);
  });

  test("equal labels keep their declared order", () => {
    const items = sortedNavItems(
      [
        { to: "/c", labelKey: "c", show: true },
        { to: "/a", labelKey: "a", show: true },
      ],
      t,
      "en",
    );
    expect(items.map((i) => i.to)).toEqual(["/c", "/a"]);
  });

  test("a pinned entry comes first whatever its label; the rest still sort", () => {
    const items = sortedNavItems(
      [
        { to: "/d", labelKey: "d", show: true },
        { to: "/", labelKey: "zzz-home", show: true, pinnedFirst: true },
        { to: "/b", labelKey: "b", show: true },
      ],
      t,
      "en",
    );
    expect(items.map((i) => i.to)).toEqual(["/", "/b", "/d"]);
    expect(items[0]).not.toHaveProperty("pinned");
  });

  test("a pinned entry the role may not open is still left out", () => {
    const items = sortedNavItems(
      [
        { to: "/", labelKey: "a", show: false, pinnedFirst: true },
        { to: "/b", labelKey: "b", show: true },
      ],
      t,
      "en",
    );
    expect(items.map((i) => i.to)).toEqual(["/b"]);
  });

  test("no language yet sorts as English", () => {
    const items = sortedNavItems(
      [
        { to: "/d", labelKey: "d", show: true },
        { to: "/b", labelKey: "b", show: true },
      ],
      t,
      undefined,
    );
    expect(items.map((i) => i.to)).toEqual(["/b", "/d"]);
  });
});
