// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * A branch an administrator has closed stays REACHABLE and becomes INERT.
 *
 * Both halves matter and they pull against each other. An owner whose other
 * venues are open is still signed in and still entitled to look at the closed
 * one — its state, its live board, the reason it is shut. What they may not do
 * is work in it, and the server refuses every such write regardless of what
 * this screen offers. These cases pin the screen to that same answer, so a
 * tile never invites an operator into a section that will bounce them back.
 *
 * An admin is exempt: this page is where the block is lifted.
 */

const auth = vi.hoisted(() => ({ user: { id: 1, role: "company_owner" } as { id: number; role: string } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/auth/permissions", () => ({ can: () => true }));
vi.mock("@/components/blocking/BlockToggle", () => ({ default: () => null }));
vi.mock("@/components/live/BranchLiveScreen", () => ({ default: () => null }));
vi.mock("@/components/ui/Avatar", () => ({ default: () => null }));
vi.mock("@/components/ui/Spinner", () => ({ default: () => null }));
vi.mock("@/components/ui/ScreenWithBg", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/hooks/useLocalReorder", () => ({
  useLocalReorder: (_key: string, keys: string[]) => ({ ordered: keys, move: () => {} }),
}));

const branch = vi.hoisted(() => ({
  current: {
    id: 5,
    address: "Abovyan 5",
    company: { name: "Cyber Zone" },
    country: "AM",
    city: "Yerevan",
    is_blocked: true,
    blocked_at: "2026-08-20T10:00:00+04:00",
  } as Record<string, unknown>,
}));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: { byId: async () => branch.current },
}));

import BranchHub, { isBranchReadOnly, readOnlyNoticeKey } from "./BranchHub";

let path = "";
const LocationProbe = () => {
  path = useLocation().pathname;
  return null;
};

const mount = async () => {
  render(
    <MemoryRouter initialEntries={["/branches/5"]}>
      <LocationProbe />
      <Routes>
        <Route path="/branches/:branchId" element={<BranchHub />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
  // The branch is fetched asynchronously; the banner is the first thing that
  // depends on it, so waiting for it waits for the whole screen.
  return screen.findAllByRole("link");
};

afterEach(() => {
  cleanup();
  auth.user = { id: 1, role: "company_owner" };
  branch.current = {
    id: 5,
    address: "Abovyan 5",
    company: { name: "Cyber Zone" },
    country: "AM",
    city: "Yerevan",
    is_blocked: true,
    blocked_at: "2026-08-20T10:00:00+04:00",
  };
});

describe("isBranchReadOnly", () => {
  test("staff of a blocked branch may only read it", () => {
    expect(isBranchReadOnly("company_owner", true)).toBe(true);
    expect(isBranchReadOnly("manager", true)).toBe(true);
  });

  test("an admin keeps working — they are the ones who can reopen it", () => {
    expect(isBranchReadOnly("admin", true)).toBe(false);
  });

  test("an open branch is never read-only", () => {
    expect(isBranchReadOnly("company_owner", false)).toBe(false);
    expect(isBranchReadOnly("company_owner", undefined)).toBe(false);
  });
});

describe("readOnlyNoticeKey", () => {
  test("its own block names the branch", () => {
    expect(readOnlyNoticeKey("2026-08-20T10:00:00+04:00")).toBe("blocking.readOnly.banner");
  });

  test("an inherited block names the company — unblocking the branch would not reopen it", () => {
    expect(readOnlyNoticeKey(null)).toBe("blocking.readOnly.bannerByCompany");
  });
});

describe("the hub of a blocked branch", () => {
  test("explains itself and disables every section", async () => {
    const links = await mount();

    expect(screen.getByText("blocking.readOnly.banner")).toBeTruthy();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("aria-disabled")).toBe("true");
      expect(link.getAttribute("title")).toBe("blocking.readOnly.tileHint");
      // Never reachable by keyboard either — a disabled section that can still
      // be tabbed into is disabled only to the mouse.
      expect(link.getAttribute("tabindex")).toBe("-1");
    }
  });

  test("clicking a disabled tile goes nowhere", async () => {
    const links = await mount();
    expect(path).toBe("/branches/5");

    // The router's own Link always calls preventDefault, so "was the event
    // cancelled" proves nothing here. Where the app ENDED UP does.
    await act(async () => {
      links[0].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });

    expect(path, "a disabled section must not be enterable").toBe("/branches/5");
  });

  test("an admin sees the same branch fully working", async () => {
    auth.user = { id: 9, role: "admin" };

    const links = await mount();

    expect(screen.queryByText("blocking.readOnly.banner")).toBeNull();
    for (const link of links) {
      expect(link.getAttribute("aria-disabled")).toBeNull();
    }
  });

  test("an open branch is not dressed up as closed", async () => {
    branch.current = { ...branch.current, is_blocked: false, blocked_at: null };

    const links = await mount();

    expect(screen.queryByText("blocking.readOnly.banner")).toBeNull();
    expect(screen.queryByText("blocking.readOnly.bannerByCompany")).toBeNull();
    for (const link of links) {
      expect(link.getAttribute("aria-disabled")).toBeNull();
    }
  });

  test("a branch closed by its company says so", async () => {
    branch.current = { ...branch.current, is_blocked: true, blocked_at: null };

    await mount();

    expect(screen.getByText("blocking.readOnly.bannerByCompany")).toBeTruthy();
  });
});
