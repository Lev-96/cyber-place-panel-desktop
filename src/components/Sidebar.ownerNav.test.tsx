// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AuthUser, Role } from "@/types/api";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Sidebar from "./Sidebar";

/**
 * The owner's two sidebar entries and the admin's Owners link.
 *
 *  - "My company" must light up on every page of the owner's company. It used
 *    to link to `/my-company`, a route that only redirects — so the pathname
 *    was never `/my-company…` and the item was never active anywhere.
 *  - "+ New branch" opens THE branch form (the module the company screens
 *    import, mocked here so the test can see it is that one) for the owner's
 *    company, and lands on the new branch after saving.
 */

const auth = vi.hoisted(() => ({ user: null as AuthUser | null }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user, logout: vi.fn() }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/notifications/NotificationsContext", () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
vi.mock("@/realtime/UpdatesNotificationContext", () => ({ useUpdatesNotification: () => ({ panel: null, agent: null }) }));
vi.mock("@/components/profile/AccountSwitchPanel", () => ({ default: () => null }));
vi.mock("@/components/profile/ProfileModal", () => ({ default: () => null }));
vi.mock("@/components/profile/AccountSwitchModal", () => ({ default: () => null }));

interface FormProps {
  companyId?: number;
  initial?: unknown;
  onClose: () => void;
  onSaved: (b: { id: number }) => void;
}
const form = vi.hoisted(() => ({ props: null as FormProps | null }));
vi.mock("@/components/branches/BranchForm", () => ({
  default: (p: FormProps) => {
    form.props = p;
    return <div data-testid="branch-form" />;
  },
}));

let currentPath = "";
const LocationProbe = () => {
  currentPath = useLocation().pathname;
  return null;
};

const signIn = (role: Role, dashboard?: AuthUser["dashboard"]) => {
  auth.user = { id: 1, name: "Test User", email: "user@t.test", role, dashboard };
};

const mountAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Sidebar />
      <LocationProbe />
    </MemoryRouter>,
  );

const myCompanyLink = () => screen.getByRole("link", { name: "nav.myCompany" });
const createButton = () => screen.queryByRole("button", { name: "nav.createBranch" });

beforeEach(() => {
  form.props = null;
  currentPath = "";
});
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

describe("owner — + New branch", () => {
  test("opens THE branch form for the owner's company", async () => {
    signIn("company_owner", { company_id: 5 });
    mountAt("/");
    expect(screen.queryByTestId("branch-form")).toBeNull();

    await act(async () => { fireEvent.click(createButton()!); });

    expect(await screen.findByTestId("branch-form")).toBeTruthy();
    expect(form.props?.companyId).toBe(5);
    // Create mode: nothing to prefill.
    expect(form.props?.initial).toBeUndefined();
  });

  test("after saving, closes and lands on the new branch", async () => {
    signIn("company_owner", { company_id: 5 });
    mountAt("/companies/5");
    await act(async () => { fireEvent.click(createButton()!); });
    await screen.findByTestId("branch-form");

    await act(async () => { form.props!.onSaved({ id: 42 }); });

    expect(currentPath).toBe("/branches/42");
    expect(screen.queryByTestId("branch-form")).toBeNull();
  });

  test("cancel closes it and goes nowhere", async () => {
    signIn("company_owner", { company_id: 5 });
    mountAt("/companies/5");
    await act(async () => { fireEvent.click(createButton()!); });
    await screen.findByTestId("branch-form");

    await act(async () => { form.props!.onClose(); });

    expect(screen.queryByTestId("branch-form")).toBeNull();
    expect(currentPath).toBe("/companies/5");
  });

  // The create request requires a company id; with none the form could only
  // fail, so the entry is not drawn at all.
  test("is hidden from an owner with no company", () => {
    signIn("company_owner", {});
    mountAt("/");

    expect(createButton()).toBeNull();
  });

  test.each([
    ["admin", {}],
    // A manager's dashboard may name the company; `branch.create` is what they lack.
    ["manager", { company_id: 5, branch_id: 3 }],
  ] as const)("is hidden from %s", (role, dashboard) => {
    signIn(role, dashboard);
    mountAt("/");

    expect(createButton()).toBeNull();
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

  test.each(["company_owner", "manager"] as const)("%s does not", (role) => {
    signIn(role, { company_id: 5 });
    mountAt("/");

    expect(screen.queryByRole("link", { name: "nav.owners" })).toBeNull();
  });
});
