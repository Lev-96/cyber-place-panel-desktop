// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * A branch's status wherever staff meet it — "Branch 1 Active / Branch 2
 * Inactive", every branch carrying its own state.
 *
 * An inactive branch is invisible to players and fully workable for staff.
 * Nothing on a staff screen used to say so, which is how production players
 * ended up seeing zero venues while every owner saw theirs. These cases pin
 * one pill per branch with the RIGHT state — amber "Inactive" on exactly the
 * inactive ones, green "Active" on the rest, including a branch whose backend
 * predates the field (absent reads as active, never as inactive) — on the hub,
 * on both lists and on the settings page. They also pin the hub's sentence,
 * which only an inactive branch gets: the same for owner and admin (either can
 * switch it) plus where the switch is, and the sentence alone for a manager.
 */

const auth = vi.hoisted(() => ({ user: { id: 1, role: "company_owner" } as { id: number; role: string } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k }) }));
vi.mock("@/components/blocking/BlockToggle", () => ({ default: () => null }));
vi.mock("@/components/live/BranchLiveScreen", () => ({ default: () => null }));
vi.mock("@/components/branches/BranchForm", () => ({ default: () => null }));
vi.mock("@/components/branches/BranchOpenDaysForm", () => ({ default: () => null }));
vi.mock("@/components/branches/BranchUnlockPinCard", () => ({ default: () => null }));
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

import BranchEdit from "./BranchEdit";
import BranchHub from "./BranchHub";
import BranchesList from "./BranchesList";
import CompanyBranches from "./CompanyBranches";

const ACTIVE = "branch.status.active";
const INACTIVE = "branch.status.inactive";

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

const mountAt = async (entry: string, path: string, element: React.ReactElement) => {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>,
  );
};

const mountHub = async () => {
  await mountAt("/branches/5", "/branches/:branchId", <BranchHub />);
  // The address renders once the branch has been fetched.
  await screen.findByText(String(data.branch.address));
};

/** The one pill a surface draws, and that it is the right one. */
const expectPill = (scope: Pick<typeof screen, "getByText" | "queryByText">, state: "active" | "inactive") => {
  const [label, other, className, hint] =
    state === "active"
      ? [ACTIVE, INACTIVE, "pill confirmed", "branch.active.hint"]
      : [INACTIVE, ACTIVE, "pill pending", "branch.inactive.hint"];
  const pill = scope.getByText(label);
  expect(pill.className).toBe(className);
  expect(pill.getAttribute("title")).toBe(hint);
  expect(scope.queryByText(other)).toBeNull();
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

      expectPill(screen, "inactive");
      expect(screen.getByRole("status").textContent).toBe(NOTICE_WITH_WHERE);
    },
  );

  // A manager cannot flip it, so pointing at a switch they do not have would
  // send them looking for something that is not there.
  test("a manager gets the sentence without the pointer", async () => {
    auth.user = { id: 4, role: "manager" };
    data.branch = branch(5, "Abovyan 5", "inactive");
    await mountHub();

    expectPill(screen, "inactive");
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

  // Every branch says what it is — an active one is labelled Active, not left
  // blank. There is nothing to explain, so no notice.
  test.each([["active"], [undefined]])("status %s reads Active in the header, with no notice", async (status) => {
    data.branch = branch(5, "Abovyan 5", status);
    await mountHub();

    expectPill(screen, "active");
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("the branch settings page", () => {
  test.each([["inactive", "inactive"], ["active", "active"], [undefined, "active"]] as const)(
    "status %s shows %s",
    async (status, shown) => {
      data.branch = branch(5, "Abovyan 5", status);
      await mountAt("/branches/5/edit", "/branches/:branchId/edit", <BranchEdit />);
      await screen.findByText("Abovyan 5");

      expectPill(screen, shown);
    },
  );
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

const expectEveryRowWithItsState = () => {
  // One pill per branch — none missing, none doubled.
  expect(screen.getAllByText(INACTIVE)).toHaveLength(1);
  expect(screen.getAllByText(ACTIVE)).toHaveLength(2);
  expectPill(within(rowOf("Inactive street 1")), "inactive");
  expectPill(within(rowOf("Active street 2")), "active");
  // A backend that predates the field: active, never a false "Inactive".
  expectPill(within(rowOf("Legacy street 3")), "active");
};

describe("the global branch list", () => {
  test.each(["admin", "company_owner"])("%s: every branch shows its own state", async (role) => {
    auth.user = { id: 1, role };
    data.list = LISTED;
    render(<MemoryRouter><BranchesList /></MemoryRouter>);
    await screen.findByText("Inactive street 1", { exact: false });

    expectEveryRowWithItsState();
  });
});

describe("a company's branch list", () => {
  test.each(["admin", "company_owner"])("%s: every branch shows its own state", async (role) => {
    auth.user = { id: 1, role };
    data.list = LISTED;
    await mountAt("/companies/3/branches", "/companies/:companyId/branches", <CompanyBranches />);
    await screen.findByText("Inactive street 1");

    expectEveryRowWithItsState();
  });
});

/**
 * The row layout. The status used to be a run of inline text inside the name
 * (or the meta line), so it read "Abovyan 5Active" and moved with every line
 * break. Now the name element holds the title and nothing else, and the pills
 * are their own flex item AFTER the text block, a sibling of it inside the row
 * link: status last, "Blocked" (when it applies) right before it, then "Open".
 */
const expectPillsApartFromName = (row: HTMLElement, title: string, pills: string[]) => {
  const name = row.querySelector(".name") as HTMLElement;
  expect(name.textContent).toBe(title);
  expect(name.querySelector(".pill")).toBeNull();
  const text = row.querySelector(".branch-row__text") as HTMLElement;
  const group = row.querySelector(".branch-row__pills") as HTMLElement;
  expect(text.contains(name)).toBe(true);
  expect(text.querySelector(".pill")).toBeNull();
  expect(text.parentElement).toBe(row);
  expect(group.parentElement).toBe(row);
  expect(text.nextElementSibling).toBe(group);
  expect(Array.from(group.children).map((c) => c.textContent)).toEqual(pills);
  expect(group.nextElementSibling?.textContent).toBe("common.open");
};

const LAYOUT = [
  { ...branch(1, "Inactive street 1", "inactive") },
  { ...branch(2, "Blocked street 2", "active"), is_blocked: true, blocked_at: "2026-09-01T00:00:00Z" },
  { ...branch(3, "Blocked with company 3", "inactive"), is_blocked: true, blocked_at: null },
];

describe("row layout: the status is never glued to the name", () => {
  test("the global list", async () => {
    auth.user = { id: 1, role: "company_owner" };
    data.list = LAYOUT;
    render(<MemoryRouter><BranchesList /></MemoryRouter>);
    await screen.findByText("Cyber Zone · Inactive street 1");

    expectPillsApartFromName(rowOf("Inactive street 1"), "Cyber Zone · Inactive street 1", [INACTIVE]);
    expectPillsApartFromName(rowOf("Blocked street 2"), "Cyber Zone · Blocked street 2", ["blocking.state.branch", ACTIVE]);
    expectPillsApartFromName(rowOf("Blocked with company 3"), "Cyber Zone · Blocked with company 3", ["blocking.state.byCompany", INACTIVE]);
  });

  test("a company's list", async () => {
    auth.user = { id: 1, role: "company_owner" };
    data.list = LAYOUT;
    await mountAt("/companies/3/branches", "/companies/:companyId/branches", <CompanyBranches />);
    await screen.findByText("Inactive street 1");

    expectPillsApartFromName(rowOf("Inactive street 1"), "Inactive street 1", [INACTIVE]);
    expectPillsApartFromName(rowOf("Blocked street 2"), "Blocked street 2", ["blocking.state.branch", ACTIVE]);
    expectPillsApartFromName(rowOf("Blocked with company 3"), "Blocked with company 3", ["blocking.state.byCompany", INACTIVE]);
  });

  // jsdom lays nothing out, so the rules that keep a long address from pushing
  // or clipping the pills are pinned where they live: the text block is the
  // one item that may shrink (min-width: 0) and wrap; the pills never shrink
  // and never break inside a label.
  test("the stylesheet lets only the text block give way", () => {
    const css = readFileSync(path.resolve(__dirname, "../styles/global.css"), "utf8");
    const rule = (selector: string) => {
      const m = css.match(new RegExp(`(^|\\n)${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`));
      expect(m, selector).not.toBeNull();
      return m![2];
    };
    expect(rule(".branch-row__text")).toMatch(/min-width:\s*0/);
    expect(rule(".branch-row__text")).toMatch(/flex:\s*1 1 auto/);
    expect(rule(".branch-row__pills")).toMatch(/flex:\s*0 0 auto/);
    expect(css).toMatch(/\.branch-row__pills \.pill,\s*\n\.branch-row__open\s*\{[^}]*white-space:\s*nowrap/);
    expect(css).toMatch(/\.branch-row__name,\s*\n\.branch-row__text \.meta\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });
});
