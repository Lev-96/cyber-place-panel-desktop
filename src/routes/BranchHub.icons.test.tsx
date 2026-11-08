// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BRANCH_SECTIONS } from "@/components/branches/branchSections";

/**
 * The branch hub's tiles (2026-11-09) draw their section's icon — the same
 * shape the section's menu shortcut draws — and a branch whose company has an
 * unpaid platform invoice explains, in one banner, what is limited and that
 * running seats carry on. The tiles stay live: the hub is not read-only.
 */

const auth = vi.hoisted(() => ({ user: { id: 1, role: "company_owner" } as { id: number; role: string } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/components/blocking/BlockToggle", () => ({ default: () => null }));
vi.mock("@/components/live/BranchLiveScreen", () => ({ default: () => null }));
vi.mock("@/components/ui/Avatar", () => ({ default: () => null }));
vi.mock("@/components/ui/ScreenWithBg", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/hooks/useLocalReorder", () => ({
  useLocalReorder: (_key: string, keys: string[]) => ({ ordered: keys, move: () => {} }),
}));

const branch = vi.hoisted(() => ({
  current: { id: 5, address: "Abovyan 5", company: { name: "Cyber Zone" }, country: "AM", city: "Yerevan", is_blocked: false, blocked_at: null } as Record<string, unknown>,
}));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: { byId: async () => branch.current },
}));

import BranchHub, { billingAccessNoticeKey } from "./BranchHub";

const mount = () => {
  render(
    <MemoryRouter initialEntries={["/branches/5"]}>
      <Routes>
        <Route path="/branches/:branchId" element={<BranchHub />} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.findAllByRole("link");
};

afterEach(() => {
  cleanup();
  auth.user = { id: 1, role: "company_owner" };
  branch.current = { ...branch.current, billing_access: undefined };
});

describe("hub tile icons", () => {
  test.each(["company_owner", "manager", "admin"])("every %s tile draws its section's icon before the title", async (role) => {
    auth.user = { id: 1, role };
    const links = await mount();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const icon = link.querySelector("svg[data-nav-icon]");
      expect(icon, link.getAttribute("href") ?? "").not.toBeNull();
      expect(icon!.children.length).toBeGreaterThan(0);
      const section = BRANCH_SECTIONS.find((s) => link.getAttribute("href") === `/branches/5/${s.path}`);
      expect(section, link.getAttribute("href") ?? "").toBeTruthy();
      expect(icon!.getAttribute("data-nav-icon")).toBe(section!.icon);
    }
  });

  test("the drag handle is still there and still the only draggable part", async () => {
    const links = await mount();
    for (const link of links) {
      expect(link.getAttribute("draggable")).toBe("false");
      expect(link.querySelector('[draggable="true"]')).not.toBeNull();
    }
  });
});

describe("billing access banner", () => {
  test("the key per access state; active and absent say nothing", () => {
    expect(billingAccessNoticeKey("restricted")).toBe("billingAccess.banner.restricted");
    expect(billingAccessNoticeKey("suspended")).toBe("billingAccess.banner.suspended");
    expect(billingAccessNoticeKey("active")).toBeNull();
    expect(billingAccessNoticeKey(undefined)).toBeNull();
    expect(billingAccessNoticeKey("something-new")).toBeNull();
  });

  test("a restricted branch says so and keeps its tiles working", async () => {
    branch.current = { ...branch.current, billing_access: "restricted" };
    const links = await mount();
    const banner = screen.getByText(/billingAccess\.banner\.restricted/);
    expect(banner.getAttribute("role")).toBe("status");
    expect(banner.textContent).toContain("billingAccess.banner.ownerAction");
    for (const link of links) expect(link.getAttribute("aria-disabled")).toBeNull();
  });

  test("a suspended branch: the suspended sentence; an admin is not told to pay", async () => {
    branch.current = { ...branch.current, billing_access: "suspended" };
    auth.user = { id: 1, role: "admin" };
    await mount();
    const banner = screen.getByText(/billingAccess\.banner\.suspended/);
    expect(banner.textContent).not.toContain("billingAccess.banner.ownerAction");
  });

  test("an older backend (no field) shows no banner", async () => {
    await mount();
    expect(screen.queryByText(/billingAccess\.banner/)).toBeNull();
  });
});
