// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * "Inactive" wherever staff meet a branch.
 *
 * An inactive branch is invisible to players and fully workable for staff.
 * Nothing on a staff screen used to say so, which is how production players
 * ended up seeing zero venues while every owner saw theirs. These cases pin
 * the indicator to exactly the inactive branches — never to an active one,
 * never to one whose backend predates the field — on the hub and on both
 * lists, and pin the hub's sentence: the same for owner and admin (either can
 * switch it) plus where the switch is, and the sentence alone for a manager.
 */

const auth = vi.hoisted(() => ({ user: { id: 1, role: "company_owner" } as { id: number; role: string } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/components/blocking/BlockToggle", () => ({ default: () => null }));
vi.mock("@/components/live/BranchLiveScreen", () => ({ default: () => null }));
vi.mock("@/components/branches/BranchForm", () => ({ default: () => null }));
vi.mock("@/components/ui/Avatar", () => ({ default: () => null }));
vi.mock("@/components/ui/ScreenWithBg", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/hooks/useLocalReorder", () => ({
  useLocalReorder: (_key: string, keys: string[]) => ({ ordered: keys, move: () => {} }),
}));

type Row = Record<string, unknown>;
const data = vi.hoisted(() => ({ branch: {} as Record<string, unknown>, list: [] as Record<string, unknown>[] }));
vi.mock("@/repositories/BranchRepository", () => ({
  branchRepository: {
    byId: async () => data.branch,
    list: async () => data.list,
    listPaged: async () => ({ data: data.list, meta: { last_page: 1 } }),
  },
}));

import BranchHub from "./BranchHub";
import BranchesList from "./BranchesList";
import CompanyBranches from "./CompanyBranches";

const branch = (id: number, address: string, status?: string): Row => ({
  id,
  company_id: 3,
  address,
  company: { name: "Cyber Zone" },
  country: "Armenia",
  city: "Yerevan",
  is_blocked: false,
  blocked_at: null,
  places_count: 4,
  ...(status === undefined ? {} : { status }),
});

const mountHub = async () => {
  render(
    <MemoryRouter initialEntries={["/branches/5"]}>
      <Routes>
        <Route path="/branches/:branchId" element={<BranchHub />} />
      </Routes>
    </MemoryRouter>,
  );
  // The address renders once the branch has been fetched.
  await screen.findByText(String(data.branch.address));
};

// The i18n mock returns keys and `fmt` leaves a key with no placeholders
// untouched, so the notice reads as the keys it is built from.
const NOTICE = "branch.inactive.notice";
const NOTICE_WITH_WHERE = "branch.inactive.notice branch.inactive.noticeWhere";

afterEach(() => {
  cleanup();
  auth.user = { id: 1, role: "company_owner" };
});

describe("the branch hub", () => {
  test.each(["company_owner", "admin"])(
    "%s sees the badge, the sentence and where the switch is",
    async (role) => {
      auth.user = { id: 9, role };
      data.branch = branch(5, "Abovyan 5", "inactive");
      await mountHub();

      const pill = screen.getByText("branch.status.inactive");
      expect(pill.className).toBe("pill pending");
      expect(pill.getAttribute("title")).toBe("branch.inactive.hint");
      expect(screen.getByRole("status").textContent).toBe(NOTICE_WITH_WHERE);
    },
  );

  // A manager cannot flip it, so pointing at a switch they do not have would
  // send them looking for something that is not there.
  test("a manager gets the sentence without the pointer", async () => {
    auth.user = { id: 4, role: "manager" };
    data.branch = branch(5, "Abovyan 5", "inactive");
    await mountHub();

    expect(screen.getByText("branch.status.inactive")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(NOTICE);
  });

  // Inactive hides the venue from players; it does not stop its staff from
  // working in it. Greying the tiles would block exactly the setup work.
  test("an inactive branch stays fully workable", async () => {
    data.branch = branch(5, "Abovyan 5", "inactive");
    await mountHub();

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("aria-disabled")).toBeNull();
    }
  });

  test.each([["active"], [undefined]])("status %s shows neither badge nor notice", async (status) => {
    data.branch = branch(5, "Abovyan 5", status);
    await mountHub();

    expect(screen.queryByText("branch.status.inactive")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

const LISTED = [
  branch(1, "Inactive street 1", "inactive"),
  branch(2, "Active street 2", "active"),
  branch(3, "Legacy street 3"),
];

/** The list row (a link) that carries a given address. */
const rowOf = (address: string): HTMLElement => {
  const row = screen.getByText(address, { exact: false }).closest("a");
  expect(row, `row for ${address}`).not.toBeNull();
  return row as HTMLElement;
};

const expectOnlyInactiveBadged = () => {
  expect(screen.getAllByText("branch.status.inactive")).toHaveLength(1);
  expect(within(rowOf("Inactive street 1")).getByText("branch.status.inactive")).toBeTruthy();
  expect(within(rowOf("Active street 2")).queryByText("branch.status.inactive")).toBeNull();
  expect(within(rowOf("Legacy street 3")).queryByText("branch.status.inactive")).toBeNull();
};

describe("the global branch list", () => {
  test.each(["admin", "company_owner"])("%s: only the inactive branch is badged", async (role) => {
    auth.user = { id: 1, role };
    data.list = LISTED;
    render(<MemoryRouter><BranchesList /></MemoryRouter>);
    await screen.findByText("Inactive street 1", { exact: false });

    expectOnlyInactiveBadged();
  });
});

describe("a company's branch list", () => {
  test.each(["admin", "company_owner"])("%s: only the inactive branch is badged", async (role) => {
    auth.user = { id: 1, role };
    data.list = LISTED;
    render(
      <MemoryRouter initialEntries={["/companies/3/branches"]}>
        <Routes>
          <Route path="/companies/:companyId/branches" element={<CompanyBranches />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("Inactive street 1");

    expectOnlyInactiveBadged();
  });
});
