// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IOwnerDeletionPreviewApi, IOwnerDetailApi } from "@/api/owners";

/**
 * The admin's page for ONE owner (`/owners/:ownerId`), driven down to the
 * transport like `Owners.test.tsx`: only `request()` is replaced, so the
 * assertions are about what `GET|PUT|DELETE /admin/owners/{id}` receive and
 * how the screen renders the show response.
 *
 * Real English copy, not keys, so a missing placeholder or a wrong key shows.
 */

interface Call { path: string; method: string; body?: unknown }
const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; body?: unknown }>,
  handler: (_c: { path: string; method: string; body?: unknown }): Promise<unknown> =>
    Promise.reject(new Error("no handler")),
}));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const call = { path, method: opts.method ?? "GET", body: opts.body };
    api.calls.push(call);
    return api.handler(call);
  },
  apiCache: { subscribe: () => () => {} },
}));

const auth = vi.hoisted(() => ({ user: { id: 1, role: "admin" } as { id: number; role: string } }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en") }) };
});
vi.mock("@/components/ui/Modal", () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
}));

import OwnerDetails from "./OwnerDetails";

const PREVIEW: IOwnerDeletionPreviewApi = {
  companies: 2,
  branches: 3,
  managers: 1,
  places: 10,
  sessions_total_count: 99,
  running_sessions: 0,
  upcoming_bookings: 0,
  members_with_balance: 0,
  can_delete: true,
  blockers: [],
};

// Noon UTC: the same calendar day in every timezone the suite may run in.
const SHOW: IOwnerDetailApi = {
  id: 1,
  name: "Ann Owner",
  email: "ann@club.test",
  created_at: "2026-09-01T12:00:00Z",
  companies: [
    {
      id: 3,
      name: "Cyber Zone",
      status: "active",
      is_blocked: false,
      branches_count: 2,
      managers_count: 1,
      branches: [
        { id: 11, address: "Abovyan 5", city: "Yerevan", status: "active", is_blocked: false },
        { id: 12, address: "Komitas 40", city: "Gyumri", status: "inactive", is_blocked: true },
      ],
    },
    {
      id: 4,
      name: "Night Club",
      status: "pending",
      is_blocked: true,
      branches_count: 0,
      managers_count: 0,
      branches: [],
    },
  ],
  deletion: PREVIEW,
};

let show: IOwnerDetailApi = SHOW;

const callsTo = (method: string, path: string) => api.calls.filter((c) => c.method === method && c.path === path);

let currentPath = "";
const LocationProbe = () => {
  currentPath = useLocation().pathname;
  return null;
};

beforeEach(() => {
  api.calls = [];
  show = SHOW;
  currentPath = "";
  api.handler = async (c: Call) => {
    if (c.path === "/admin/owners/1" && c.method === "GET") return { data: show };
    if (c.path === "/admin/owners/1" && c.method === "PUT") return { data: { ...show, ...(c.body as object) } };
    if (c.path === "/admin/owners/1" && c.method === "DELETE") {
      return { data: { owner_id: 1, company_ids: [3, 4], branches: 2, deleted_users: 2, rows: {} } };
    }
    throw new Error(`unexpected ${c.method} ${c.path}`);
  };
});

afterEach(() => {
  cleanup();
  auth.user = { id: 1, role: "admin" };
});

const mount = async (entry = "/owners/1") => {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/owners/:ownerId" element={<OwnerDetails />} />
        <Route path="/owners" element={<div>owners list</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
};

const mountLoaded = async () => {
  await mount();
  await screen.findByText("ann@club.test");
};

/** The card of one company, found by its name link. */
const companyCard = (name: string) =>
  screen.getByRole("link", { name }).closest(".owner-company") as HTMLElement;

/** One branch row — a link to the branch — found by its address. */
const branchRow = (address: string) => screen.getByText(address).closest("a") as HTMLElement;

describe("the owner's page", () => {
  test("shows who the owner is", async () => {
    await mountLoaded();

    expect(callsTo("GET", "/admin/owners/1")).toHaveLength(1);
    expect(screen.getAllByText("Ann Owner").length).toBeGreaterThan(0);
    expect(screen.getByText("ann@club.test")).toBeTruthy();
    expect(screen.getByText("01.09.2026")).toBeTruthy();
  });

  test("lists each company with its link, counts and state", async () => {
    await mountLoaded();

    const zone = companyCard("Cyber Zone");
    expect(within(zone).getByRole("link", { name: "Cyber Zone" }).getAttribute("href")).toBe("/companies/3");
    expect(within(zone).getByText("Branches: 2")).toBeTruthy();
    expect(within(zone).getByText("Managers: 1")).toBeTruthy();
    expect(within(zone).getByText("Active", { selector: ".pill.active" })).toBeTruthy();
    expect(within(zone).queryByText("Blocked", { selector: ".owner-company__head .pill" })).toBeNull();

    const night = companyCard("Night Club");
    expect(within(night).getByRole("link", { name: "Night Club" }).getAttribute("href")).toBe("/companies/4");
    expect(within(night).getByText("Pending").className).toBe("pill pending");
    expect(within(night).getByText("Blocked").className).toBe("pill blocked");
  });

  test("lists every branch of a company with its address, city, status and link", async () => {
    await mountLoaded();

    const active = branchRow("Abovyan 5");
    expect(active.getAttribute("href")).toBe("/branches/11");
    expect(within(active).getByText("Yerevan")).toBeTruthy();
    expect(within(active).getByText("Active").className).toBe("pill confirmed");
    expect(within(active).queryByText("Inactive")).toBeNull();
    expect(within(active).queryByText("Blocked")).toBeNull();

    const inactive = branchRow("Komitas 40");
    expect(inactive.getAttribute("href")).toBe("/branches/12");
    expect(within(inactive).getByText("Gyumri")).toBeTruthy();
    expect(within(inactive).getByText("Inactive").className).toBe("pill pending");
    expect(within(inactive).getByText("Blocked").className).toBe("pill blocked");

    // Both inside their own company's card.
    expect(companyCard("Cyber Zone").contains(active)).toBe(true);
    expect(companyCard("Cyber Zone").contains(inactive)).toBe(true);
  });

  // `OwnerResource::branch()` declares address, city and status nullable.
  test("a branch with null fields still renders: №id, a dash, Active", async () => {
    show = {
      ...SHOW,
      companies: [{ ...SHOW.companies![0], branches: [{ id: 13, address: null, city: null, status: null, is_blocked: false }] }],
    };
    await mountLoaded();

    const row = branchRow("№13");
    expect(row.getAttribute("href")).toBe("/branches/13");
    expect(within(row).getByText("-")).toBeTruthy();
    expect(within(row).getByText("Active").className).toBe("pill confirmed");
  });

  test("a company with an empty branch list says so", async () => {
    await mountLoaded();

    expect(within(companyCard("Night Club")).getByText("No branches yet.")).toBeTruthy();
    expect(within(companyCard("Night Club")).queryAllByRole("link")).toHaveLength(1);
  });

  // An older backend sends no `branches` key at all: the counts are the whole
  // story, and the screen must not claim "No branches yet." about a company
  // that has two.
  test("without the branches key it shows the counts only", async () => {
    show = {
      ...SHOW,
      companies: SHOW.companies!.map(({ branches: _drop, ...company }) => company),
    };
    await mountLoaded();

    const zone = companyCard("Cyber Zone");
    expect(within(zone).getByText("Branches: 2")).toBeTruthy();
    expect(within(zone).getByText("Managers: 1")).toBeTruthy();
    expect(within(zone).queryAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("No branches yet.")).toBeNull();
    expect(screen.queryByText("Abovyan 5")).toBeNull();
  });

  test("an owner with no company says so", async () => {
    show = { ...SHOW, companies: [] };
    await mountLoaded();

    expect(screen.getByText("No company")).toBeTruthy();
  });

  test("a failed read shows the error", async () => {
    api.handler = async () => Promise.reject(Object.assign(new Error("Server Error"), { status: 500 }));
    await mount();

    expect(await screen.findByText("Server Error")).toBeTruthy();
  });

  test("a non-numeric id asks nothing of the server", async () => {
    await mount("/owners/abc");

    expect(await screen.findByText("Invalid owner id")).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  test("the way back leads to the owners list", async () => {
    await mountLoaded();

    expect(screen.getByRole("link", { name: "← Owners" }).getAttribute("href")).toBe("/owners");
  });
});

describe("editing", () => {
  test("opens THE owner form, saves with PUT and re-reads the owner", async () => {
    await mountLoaded();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Edit" })); });
    expect(screen.getByText("Edit owner")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("Ann Owner"), { target: { value: "Ann Renamed" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });

    await waitFor(() => expect(callsTo("PUT", "/admin/owners/1")).toHaveLength(1));
    expect(callsTo("PUT", "/admin/owners/1")[0].body).toEqual({ name: "Ann Renamed", email: "ann@club.test" });
    await waitFor(() => expect(callsTo("GET", "/admin/owners/1")).toHaveLength(2));
    expect(screen.queryByText("Edit owner")).toBeNull();
  });
});

describe("deleting", () => {
  test("confirms with THE delete dialog, deletes and goes back to the list", async () => {
    await mountLoaded();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete" })); });
    const question = await screen.findByText(/^Delete owner Ann Owner/);
    await waitFor(() => expect(question.textContent).toContain("This cannot be undone."));
    expect(question.textContent).toContain("Companies: 2");

    const card = question.closest(".card") as HTMLElement;
    await act(async () => { fireEvent.click(within(card).getByRole("button", { name: "Delete" })); });

    expect(callsTo("DELETE", "/admin/owners/1")).toHaveLength(1);
    await waitFor(() => expect(currentPath).toBe("/owners"));
  });

  test("cancel keeps the owner and the page", async () => {
    await mountLoaded();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete" })); });
    const question = await screen.findByText(/^Delete owner Ann Owner/);
    const card = question.closest(".card") as HTMLElement;
    await act(async () => { fireEvent.click(within(card).getByRole("button", { name: "Cancel" })); });

    expect(screen.queryByText(/^Delete owner Ann Owner/)).toBeNull();
    expect(callsTo("DELETE", "/admin/owners/1")).toHaveLength(0);
    expect(currentPath).toBe("/owners/1");
  });
});

describe("without the write permissions", () => {
  // The route is admin-only; the buttons still read their own permissions
  // rather than riding on the route guard.
  test("there is no Edit or Delete", async () => {
    auth.user = { id: 5, role: "company_owner" };
    await mountLoaded();

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });
});
