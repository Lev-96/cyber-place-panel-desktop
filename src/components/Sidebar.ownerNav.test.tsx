// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AuthUser, Role } from "@/types/api";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import Sidebar from "./Sidebar";

/**
 * The owner's sidebar entries and the admin's Owners link.
 *
 *  - "My company" must light up on every page of the owner's company. It used
 *    to link to `/my-company`, a route that only redirects, so the pathname
 *    was never `/my-company...` and the item was never active anywhere.
 *  - The navigation is links only. "+ New branch" used to be a button in it;
 *    it moved to the header of the Branches page (`BranchesList.create.test`).
 */

const auth = vi.hoisted(() => ({ user: null as AuthUser | null }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user, logout: vi.fn() }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/notifications/NotificationsContext", () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
vi.mock("@/realtime/UpdatesNotificationContext", () => ({ useUpdatesNotification: () => ({ panel: null, agent: null }) }));
vi.mock("@/components/profile/AccountSwitchPanel", () => ({ default: () => null }));
vi.mock("@/components/profile/ProfileModal", () => ({ default: () => null }));
vi.mock("@/components/profile/AccountSwitchModal", () => ({ default: () => null }));

const signIn = (role: Role, dashboard?: AuthUser["dashboard"]) => {
  auth.user = { id: 1, name: "Test User", email: "user@t.test", role, dashboard };
};

const mountAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Sidebar />
    </MemoryRouter>,
  );

const myCompanyLink = () => screen.getByRole("link", { name: "nav.myCompany" });
afterEach(() => cleanup());

/**
 * The company's pages as the router actually declares them. Read from the
 * route table itself so a renamed route fails here instead of silently
 * leaving the item dark again.
 */
const COMPANY_PAGES = ["/companies/:companyId", "/companies/:companyId/branches", "/companies/:companyId/revenue"];

describe("the route table", () => {
  test("still declares the company pages this item has to cover, and /owners", () => {
    const app = readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");
    for (const route of [...COMPANY_PAGES, "/owners"]) {
      expect(app, `App.tsx route ${route}`).toContain(`path="${route}"`);
    }
  });

  test("guards /owners with the admin-only owner.view permission", () => {
    const app = readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");
    expect(app).toMatch(/path="\/owners"\s+element=\{\s*<RoleGuard perm="owner\.view">\s*<Owners \/>/);
  });

  // The owner's own page is as admin-only as the list it opens from.
  test("guards /owners/:ownerId with the same permission", () => {
    const app = readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");
    expect(app).toMatch(/path="\/owners\/:ownerId"\s+element=\{\s*<RoleGuard perm="owner\.view">\s*<OwnerDetails \/>/);
  });
});

describe("owner — My company", () => {
  test.each(COMPANY_PAGES.map((p) => p.replace(":companyId", "5")))("is the current item on %s", (page) => {
    signIn("company_owner", { company_id: 5 });
    mountAt(page);

    expect(myCompanyLink().getAttribute("href")).toBe("/companies/5");
    expect(myCompanyLink().getAttribute("aria-current")).toBe("page");
  });

  test.each(["/", "/branches", "/branches/9", "/companies/6"])("is not the current item on %s", (page) => {
    signIn("company_owner", { company_id: 5 });
    mountAt(page);

    expect(myCompanyLink().getAttribute("aria-current")).toBeNull();
  });

  // No company linked: `/my-company` is where that is explained, so the item
  // still goes somewhere useful rather than to `/companies/undefined`.
  test("without a company it falls back to /my-company", () => {
    signIn("company_owner", {});
    mountAt("/");

    expect(myCompanyLink().getAttribute("href")).toBe("/my-company");
  });
});

describe("owner, no create button in the navigation", () => {
  // The create action lives on the Branches page now. The column goes straight
  // from "Branches" to the next section, and holds nothing that is not a link.
  test("Branches is followed by the next link, not by an action", () => {
    signIn("company_owner", { company_id: 5 });
    mountAt("/");

    const branches = screen.getByRole("link", { name: "nav.branches" });
    expect(branches.nextElementSibling?.tagName).toBe("A");
    expect(screen.queryByText("branchesList.newBranch")).toBeNull();
    expect(screen.queryByText("nav.createBranch")).toBeNull();
  });

  test.each([
    ["company_owner", { company_id: 5 }],
    ["admin", {}],
    ["manager", { company_id: 5, branch_id: 3 }],
  ] as const)("%s: the navigation holds links only", (role, dashboard) => {
    signIn(role, dashboard);
    const { container } = mountAt("/");

    const nav = container.querySelector("nav.sidebar-nav") as HTMLElement;
    expect(within(nav).queryAllByRole("button")).toHaveLength(0);
  });

  // The sidebar is in the first paint of every screen; the form (with the map
  // and the phone library) must not come back into it by way of a lazy import.
  test("the sidebar does not carry the branch form, and its button styles are gone", () => {
    const sidebar = readFileSync(path.resolve(__dirname, "Sidebar.tsx"), "utf8");
    expect(sidebar).not.toContain("BranchForm");
    const css = readFileSync(path.resolve(__dirname, "../styles/global.css"), "utf8");
    expect(css).not.toContain("sidebar-action");
  });
});

describe("admin — Owners", () => {
  test("the admin gets the Owners section", () => {
    signIn("admin");
    mountAt("/owners");

    const link = screen.getByRole("link", { name: "nav.owners" });
    expect(link.getAttribute("href")).toBe("/owners");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  // An owner's own page is inside the section, so the section stays lit.
  test("stays the current item on an owner's page", () => {
    signIn("admin");
    mountAt("/owners/7");

    expect(screen.getByRole("link", { name: "nav.owners" }).getAttribute("aria-current")).toBe("page");
  });

  test.each(["company_owner", "manager"] as const)("%s does not", (role) => {
    signIn(role, { company_id: 5 });
    mountAt("/");

    expect(screen.queryByRole("link", { name: "nav.owners" })).toBeNull();
  });
});
