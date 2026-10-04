// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { can } from "@/auth/permissions";
import type { Role } from "@/types/api";

/**
 * The Security section is the admin's alone: the permission, the route guard
 * and the tab-in-the-URL contract. The backend's `admin` middleware is the
 * real boundary; these pin that an owner or a manager is never shown the way
 * to it.
 */

const auth = vi.hoisted(() => ({ user: { id: 1, role: "admin" } as { id: number; role: string } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en"), lang: "en" }) };
});
// The tabs are covered by their own tests; here only WHICH one is mounted matters.
vi.mock("@/components/security/BlockedIpsTab", () => ({ default: () => <div>ips-tab</div> }));
vi.mock("@/components/security/BlockedCountriesTab", () => ({ default: () => <div>countries-tab</div> }));
vi.mock("@/components/security/IpActivityTab", () => ({ default: () => <div>activity-tab</div> }));

import RoleGuard from "@/auth/RoleGuard";
import Security, { securityTabOf } from "./Security";

afterEach(() => {
  cleanup();
  auth.user = { id: 1, role: "admin" };
});

const mountAt = (entry: string, role: Role) => {
  auth.user = { id: 1, role };
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route path="/security" element={<RoleGuard perm="menu.security"><Security /></RoleGuard>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("permission", () => {
  test("is the admin's only", () => {
    expect(can("admin", "menu.security")).toBe(true);
    expect(can("company_owner", "menu.security")).toBe(false);
    expect(can("manager", "menu.security")).toBe(false);
  });

  test("App.tsx guards /security with it", () => {
    const app = readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");
    expect(app).toMatch(/path="\/security"\s+element=\{\s*<RoleGuard perm="menu\.security">\s*<Security \/>/);
  });

  test.each<Role>(["company_owner", "manager"])("%s opening /security lands on home, not on the section", (role) => {
    mountAt("/security?tab=ips", role);
    expect(screen.getByText("home")).toBeTruthy();
    expect(screen.queryByText("ips-tab")).toBeNull();
  });
});

describe("tabs in the URL", () => {
  test.each([
    ["/security", "ips-tab"],
    ["/security?tab=ips", "ips-tab"],
    ["/security?tab=countries", "countries-tab"],
    ["/security?tab=activity", "activity-tab"],
    // The tabs removed on 2026-09-29: an old link lands on the first tab.
    ["/security?tab=access", "ips-tab"],
    ["/security?tab=audit", "ips-tab"],
    ["/security?tab=nonsense", "ips-tab"],
  ])("%s shows %s", (entry, shown) => {
    mountAt(entry, "admin");
    expect(screen.getByText(shown)).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  test("the selected tab is the URL's", () => {
    mountAt("/security?tab=countries", "admin");
    expect(screen.getByRole("tab", { name: "Blocked countries" }).getAttribute("aria-selected")).toBe("true");
  });

  test("securityTabOf falls back to the IP tab for anything unknown", () => {
    expect(securityTabOf(null)).toBe("ips");
    expect(securityTabOf("countries")).toBe("countries");
    expect(securityTabOf("activity")).toBe("activity");
    expect(securityTabOf("audit")).toBe("ips");
    expect(securityTabOf("toString")).toBe("ips");
  });
});
