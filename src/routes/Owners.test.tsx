// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IOwnerApi, IOwnerDetailApi, IOwnerDeletionPreviewApi } from "@/api/owners";

/**
 * The admin's Owners section, driven from the screen down to the transport:
 * `request()` is the only thing replaced, so every assertion is about the URL,
 * verb and body the backend's `/admin/owners` would actually receive.
 *
 * Real English copy (not keys) is rendered on purpose — the counts and the
 * blockers are sentences with numbers in them, and a key would hide a missing
 * placeholder.
 */

interface Call { path: string; method: string; params?: Record<string, unknown>; body?: unknown }
const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; params?: Record<string, unknown>; body?: unknown }>,
  handler: (_c: { path: string; method: string; params?: Record<string, unknown>; body?: unknown }): Promise<unknown> =>
    Promise.reject(new Error("no handler")),
}));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { method?: string; params?: Record<string, unknown>; body?: unknown } = {}) => {
    const call = { path, method: opts.method ?? "GET", params: opts.params, body: opts.body };
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

import Owners from "./Owners";

const ANN: IOwnerApi = {
  id: 1,
  name: "Ann Owner",
  email: "ann@club.test",
  created_at: "2026-09-01T10:00:00+04:00",
  companies: [{ id: 3, name: "Cyber Zone", status: "active", is_blocked: true, branches_count: 2, managers_count: 1 }],
};
const BOB: IOwnerApi = { id: 2, name: "Bob Nocompany", email: "bob@club.test", created_at: null, companies: [] };
const CARL: IOwnerApi = { id: 4, name: "Carl Pagetwo", email: "carl@club.test", created_at: null, companies: [] };

const PREVIEW: IOwnerDeletionPreviewApi = {
  companies: 1,
  branches: 2,
  managers: 1,
  places: 10,
  sessions_total_count: 99,
  running_sessions: 0,
  upcoming_bookings: 0,
  members_with_balance: 3,
  can_delete: true,
  blockers: [],
};

const BLOCKERS = [
  { code: "running_sessions", count: 2, message: "Running sessions: 2." },
  { code: "upcoming_bookings", count: 3, message: "Upcoming bookings: 3." },
];

const page = (data: IOwnerApi[], lastPage: number) => ({
  data,
  meta: { current_page: 1, last_page: lastPage, per_page: 20, total: data.length },
});

const listCalls = () => api.calls.filter((c) => c.path === "/admin/owners" && c.method === "GET");
const callsTo = (method: string, path: string) => api.calls.filter((c) => c.method === method && c.path === path);

let preview: IOwnerDeletionPreviewApi = PREVIEW;
let deleteResult: () => Promise<unknown> = async () => ({ data: { owner_id: 1, company_ids: [3], branches: 2, deleted_users: 2, rows: {} } });

const apiError = (status: number, body: unknown) =>
  Object.assign(new Error((body as { message?: string })?.message ?? `HTTP ${status}`), { status, body });

beforeEach(() => {
  api.calls = [];
  preview = PREVIEW;
  deleteResult = async () => ({ data: { owner_id: 1, company_ids: [3], branches: 2, deleted_users: 2, rows: {} } });
  api.handler = async (c: Call) => {
    if (c.path === "/admin/owners" && c.method === "GET") {
      if (c.params?.search === "ann") return page([ANN], 1);
      return c.params?.page === 2 ? page([CARL], 2) : page([ANN, BOB], 2);
    }
    if (c.path === "/admin/owners/1" && c.method === "GET") {
      const detail: IOwnerDetailApi = { ...ANN, deletion: preview };
      return { data: detail };
    }
    if (c.path === "/admin/owners/1" && c.method === "PUT") return { data: { ...ANN, ...(c.body as object) } };
    if (c.path === "/admin/owners/1" && c.method === "DELETE") return deleteResult();
    throw new Error(`unexpected ${c.method} ${c.path}`);
  };
});

afterEach(() => {
  cleanup();
  auth.user = { id: 1, role: "admin" };
});

const mount = async () => {
  render(<MemoryRouter><Owners /></MemoryRouter>);
  await screen.findByText("Ann Owner");
};

const rowOf = (name: string) => screen.getByText(name).closest(".list-item") as HTMLElement;

/** The confirmation card and its pre-line message. */
const dialog = () => screen.getByText(/^Delete owner Ann Owner/).closest(".card") as HTMLElement;
const dialogText = () => screen.getByText(/^Delete owner Ann Owner/).textContent ?? "";
const dialogConfirm = () => within(dialog()).getByRole("button", { name: "Delete" }) as HTMLButtonElement;

const openDelete = async () => {
  await act(async () => { fireEvent.click(within(rowOf("Ann Owner")).getByRole("button", { name: "Delete" })); });
  await waitFor(() => expect(dialogText()).not.toContain("Checking what would be deleted"));
};

describe("the list", () => {
  test("shows each owner with their company, its counts and its state", async () => {
    await mount();

    const ann = rowOf("Ann Owner");
    expect(within(ann).getByText("ann@club.test")).toBeTruthy();
    // The company name is the "view" action: the existing company page.
    expect(within(ann).getByRole("link", { name: "Cyber Zone" }).getAttribute("href")).toBe("/companies/3");
    expect(within(ann).getByText("Branches: 2")).toBeTruthy();
    expect(within(ann).getByText("Managers: 1")).toBeTruthy();
    expect(within(ann).getByText("Active").className).toBe("pill active");
    expect(within(ann).getByText("Blocked").className).toBe("pill blocked");

    expect(within(rowOf("Bob Nocompany")).getByText("No company")).toBeTruthy();
    expect(listCalls()[0].params).toMatchObject({ page: 1, per_page: 20 });
  });

  test("pages through the server's pages", async () => {
    await mount();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "2" })); });

    expect(await screen.findByText("Carl Pagetwo")).toBeTruthy();
    expect(listCalls().at(-1)?.params).toMatchObject({ page: 2 });
  });

  test("searches on the server after a pause, from page 1", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "2" })); });
    await screen.findByText("Carl Pagetwo");
    const before = listCalls().length;

    fireEvent.change(screen.getByRole("textbox", { name: "Search by name, email or company" }), { target: { value: " ann " } });

    // Debounced: nothing leaves on the keystroke itself.
    expect(listCalls()).toHaveLength(before);
    await waitFor(() => expect(listCalls().at(-1)?.params).toMatchObject({ search: "ann", page: 1 }));
    await waitFor(() => expect(screen.queryByText("Carl Pagetwo")).toBeNull());
    expect(screen.getByText("Ann Owner")).toBeTruthy();
    // ONE request for the new query, and it asks for page 1 — never page 2 of
    // a result that may not have one, patched up by a second request.
    const searches = listCalls().filter((c) => c.params?.search === "ann");
    expect(searches.map((c) => c.params?.page)).toEqual([1]);
  });
});

describe("editing", () => {
  test("saves name and email with PUT and re-reads the list", async () => {
    await mount();
    const before = listCalls().length;

    await act(async () => { fireEvent.click(within(rowOf("Ann Owner")).getByRole("button", { name: "Edit" })); });
    fireEvent.change(screen.getByDisplayValue("Ann Owner"), { target: { value: "Ann Renamed" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });

    await waitFor(() => expect(callsTo("PUT", "/admin/owners/1")).toHaveLength(1));
    expect(callsTo("PUT", "/admin/owners/1")[0].body).toEqual({ name: "Ann Renamed", email: "ann@club.test" });
    await waitFor(() => expect(listCalls().length).toBe(before + 1));
    expect(screen.queryByDisplayValue("Ann Renamed")).toBeNull();
  });

  test("a taken email is shown and the form stays open", async () => {
    const base = api.handler;
    api.handler = async (c: Call) =>
      c.method === "PUT"
        ? Promise.reject(apiError(422, { message: "invalid", errors: { email: ["The email has already been taken."] } }))
        : base(c);
    await mount();

    await act(async () => { fireEvent.click(within(rowOf("Ann Owner")).getByRole("button", { name: "Edit" })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });

    expect(await screen.findByText("email: The email has already been taken.")).toBeTruthy();
    expect(screen.getByDisplayValue("Ann Owner")).toBeTruthy();
  });
});

describe("deleting", () => {
  test("shows what goes with the owner, then deletes and re-reads the list", async () => {
    await mount();
    await openDelete();

    // Asked the server first — the counts come from the preview.
    expect(callsTo("GET", "/admin/owners/1")).toHaveLength(1);
    const text = dialogText();
    for (const line of [
      "Companies: 1", "Branches: 2", "Manager accounts: 1", "Places: 10",
      "Sessions in history: 99", "Member cards with a balance: 3", "This cannot be undone.",
    ]) {
      expect(text).toContain(line);
    }
    expect(dialogConfirm().disabled).toBe(false);
    const before = listCalls().length;

    await act(async () => { fireEvent.click(dialogConfirm()); });

    expect(callsTo("DELETE", "/admin/owners/1")).toHaveLength(1);
    await waitFor(() => expect(listCalls().length).toBe(before + 1));
    expect(screen.queryByText(/^Delete owner Ann Owner/)).toBeNull();
  });

  test("a preview with blockers explains them and refuses to delete", async () => {
    preview = { ...PREVIEW, running_sessions: 2, upcoming_bookings: 3, can_delete: false, blockers: BLOCKERS };
    await mount();
    await openDelete();

    const text = dialogText();
    expect(text).toContain("It can't be deleted yet:");
    expect(text).toContain("Running sessions: 2 — stop them first.");
    expect(text).toContain("Upcoming bookings: 3 — cancel them first (players are notified).");
    expect(text).not.toContain("This cannot be undone.");
    expect(dialogConfirm().disabled).toBe(true);

    await act(async () => { fireEvent.click(dialogConfirm()); });
    expect(callsTo("DELETE", "/admin/owners/1")).toHaveLength(0);
  });

  // The world can move between the preview and the press: a session starts,
  // a phone books. The 409 is computed under the delete's own locks.
  test("a 409 from the delete replaces the preview with the server's blockers", async () => {
    deleteResult = async () =>
      Promise.reject(apiError(409, { message: "blocked", code: "deletion_blocked", blockers: [BLOCKERS[0]] }));
    await mount();
    await openDelete();
    const before = listCalls().length;

    await act(async () => { fireEvent.click(dialogConfirm()); });

    await waitFor(() => expect(dialogText()).toContain("Running sessions: 2 — stop them first."));
    expect(dialogConfirm().disabled).toBe(true);
    expect(callsTo("DELETE", "/admin/owners/1")).toHaveLength(1);
    expect(listCalls().length).toBe(before);
  });

  test("a blocker this build does not know is said in the server's words", async () => {
    preview = { ...PREVIEW, can_delete: false, blockers: [{ code: "unpaid_invoices", count: 1, message: "Unpaid invoices: 1." }] };
    await mount();
    await openDelete();

    expect(dialogText()).toContain("• Unpaid invoices: 1.");
    expect(dialogConfirm().disabled).toBe(true);
  });

  test("without a preview nothing can be deleted", async () => {
    const base = api.handler;
    api.handler = async (c: Call) =>
      c.method === "GET" && c.path === "/admin/owners/1" ? Promise.reject(apiError(500, { message: "Server Error" })) : base(c);
    await mount();
    await openDelete();

    expect(dialogText()).toContain("Could not check what would be deleted");
    expect(dialogConfirm().disabled).toBe(true);
  });

  test("cancel closes the dialog and deletes nothing", async () => {
    await mount();
    await openDelete();

    await act(async () => { fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" })); });

    expect(screen.queryByText(/^Delete owner Ann Owner/)).toBeNull();
    expect(callsTo("DELETE", "/admin/owners/1")).toHaveLength(0);
  });
});

describe("without the write permissions", () => {
  // The route is admin-only; this pins that the row buttons read their own
  // permissions rather than riding on the route guard.
  test("rows carry no Edit or Delete", async () => {
    auth.user = { id: 5, role: "company_owner" };
    await mount();

    expect(within(rowOf("Ann Owner")).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(within(rowOf("Ann Owner")).queryByRole("button", { name: "Delete" })).toBeNull();
  });
});
