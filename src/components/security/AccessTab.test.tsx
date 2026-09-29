// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IClientAccessApi, IStaffAccessApi, IStaffSessionApi } from "@/api/security";
import type { ClientAccessStatus } from "@/types/security";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

/**
 * Web & Telegram access, driven from the screen down to the transport:
 * `request()` is the only thing replaced, so every assertion is about the URL,
 * verb and query the backend's `/admin/client-access` and `/admin/staff/*`
 * would actually receive. Real English copy is rendered (not keys).
 */

interface Call { path: string; method: string; params?: Record<string, unknown> }
const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; params?: Record<string, unknown> }>,
  handler: (_c: { path: string; method: string; params?: Record<string, unknown> }): Promise<unknown> =>
    Promise.reject(new Error("no handler")),
}));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { method?: string; params?: Record<string, unknown> } = {}) => {
    const call = { path, method: opts.method ?? "GET", params: opts.params };
    api.calls.push(call);
    return api.handler(call);
  },
  apiCache: { subscribe: () => () => {} },
}));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, "en"), lang: "en" }) };
});
vi.mock("@/components/ui/Modal", () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
}));

import AccessTab from "./AccessTab";

const client = (status: ClientAccessStatus, allowed = true): IClientAccessApi => ({ status, allowed, granted_at: null, revoked_at: null });

const OWNER: IStaffAccessApi = {
  id: 12,
  name: "Ann Owner",
  email: "ann@club.test",
  role: "company_owner",
  companies: [{ id: 3, name: "Cyber Zone" }],
  branches: [{ id: 7, address: "Abovyan 5", company_id: 3 }],
  clients: { owner_web: client("active"), telegram: client("pending") },
  telegram_username: "ann_tg",
  sessions: 3,
};
const MANAGER: IStaffAccessApi = {
  id: 13,
  name: "Mike Manager",
  email: "mike@club.test",
  role: "manager",
  companies: [{ id: 3, name: "Cyber Zone" }],
  branches: [],
  // Telegram is never a manager's: the server says so with allowed=false,
  // and the status it carries must not leak into a badge or a button.
  clients: { owner_web: client("revoked"), telegram: client("active", false) },
  telegram_username: null,
  sessions: 0,
};

const SESSIONS: IStaffSessionApi[] = [
  { id: 991, client: "desktop", name: "Front desk PC", created_at: "2026-09-20T10:00:00Z", last_used_at: null, expires_at: null, last_ip: "203.0.113.9", user_agent: "Electron" },
  { id: 992, client: "owner_web", name: "Chrome", created_at: "2026-09-21T10:00:00Z", last_used_at: "2026-09-22T10:00:00Z", expires_at: "2026-10-21T10:00:00Z", last_ip: null, user_agent: null },
];

const listCalls = () => api.calls.filter((c) => c.path === "/admin/client-access");
const callsTo = (method: string, path: string) => api.calls.filter((c) => c.method === method && c.path === path);

beforeEach(() => {
  api.calls = [];
  api.handler = async (c: Call) => {
    if (c.path === "/admin/client-access") {
      return { data: [OWNER, MANAGER], meta: { current_page: 1, last_page: 1, total: 2, per_page: 25 } };
    }
    if (c.path === "/company" || c.path === "/branches") return { data: [] };
    if (c.method === "PUT" || c.method === "DELETE") return { message: "ok", revoked: 2 };
    if (c.path === "/admin/staff/12/sessions") return { data: SESSIONS };
    throw new Error(`unexpected ${c.method} ${c.path}`);
  };
});
afterEach(() => cleanup());

const mount = async () => {
  render(<ConfirmProvider><AccessTab /></ConfirmProvider>);
  await screen.findByText("Ann Owner");
};

const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;
/** The table cell of one client in one row, by its column label. */
const cellOf = (name: string, clientLabel: string) =>
  within(rowOf(name)).getAllByRole("cell").find((td) => td.getAttribute("data-label") === clientLabel) as HTMLElement;

/** The in-app confirmation (the only `.card` rendered by the confirm dialog). */
const confirmCard = () => screen.getByRole("button", { name: "Cancel" }).closest(".card") as HTMLElement;

describe("status badges", () => {
  test("print the server's status per client and offer the matching action", async () => {
    await mount();

    const ownerWeb = cellOf("Ann Owner", "Web app");
    expect(within(ownerWeb).getByText("Active").className).toBe("pill confirmed");
    expect(within(ownerWeb).getByRole("button", { name: "Revoke access: Web app" })).toBeTruthy();

    const tg = cellOf("Ann Owner", "Telegram");
    expect(within(tg).getByText("Pending").className).toBe("pill pending");
    expect(within(tg).getByRole("button", { name: "Revoke access: Telegram" })).toBeTruthy();

    const mikeWeb = cellOf("Mike Manager", "Web app");
    expect(within(mikeWeb).getByText("Revoked").className).toBe("pill cancelled");
    expect(within(mikeWeb).getByRole("button", { name: "Grant access: Web app" })).toBeTruthy();
  });

  test("a client the role can never have shows the empty mark and no button", async () => {
    await mount();

    const tg = cellOf("Mike Manager", "Telegram");
    expect(tg.textContent).toBe("-");
    expect(within(tg).queryByRole("button")).toBeNull();
    expect(within(tg).queryByText("Active")).toBeNull();
  });
});

describe("grant and revoke", () => {
  test("grant is one PUT for that user and client, then the page is read again", async () => {
    await mount();
    const before = listCalls().length;

    await act(async () => {
      fireEvent.click(within(cellOf("Mike Manager", "Web app")).getByRole("button", { name: "Grant access: Web app" }));
    });

    await waitFor(() => expect(callsTo("PUT", "/admin/staff/13/client-access/owner_web")).toHaveLength(1));
    await waitFor(() => expect(listCalls().length).toBe(before + 1));
    expect(api.calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  test("revoke asks first; Cancel sends nothing", async () => {
    await mount();

    await act(async () => {
      fireEvent.click(within(cellOf("Ann Owner", "Telegram")).getByRole("button", { name: "Revoke access: Telegram" }));
    });
    expect(confirmCard().textContent).toContain("Revoke Telegram access for Ann Owner?");

    await act(async () => { fireEvent.click(within(confirmCard()).getByRole("button", { name: "Cancel" })); });
    expect(api.calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  test("revoke confirmed is one DELETE for that user and client", async () => {
    await mount();

    await act(async () => {
      fireEvent.click(within(cellOf("Ann Owner", "Telegram")).getByRole("button", { name: "Revoke access: Telegram" }));
    });
    await act(async () => { fireEvent.click(within(confirmCard()).getByRole("button", { name: "Revoke" })); });

    await waitFor(() => expect(callsTo("DELETE", "/admin/staff/12/client-access/telegram")).toHaveLength(1));
    expect(api.calls.some((c) => c.method === "PUT")).toBe(false);
  });
});

describe("filters", () => {
  test("client and status travel together to the server, starting on page 1", async () => {
    await mount();
    const select = screen.getByText("App and status").closest("label")?.querySelector("select") as HTMLSelectElement;

    await act(async () => { fireEvent.change(select, { target: { value: "telegram:pending" } }); });

    await waitFor(() => {
      const last = listCalls().at(-1);
      expect(last?.params).toMatchObject({ client: "telegram", status: "pending", page: 1 });
    });
  });
});

describe("sessions", () => {
  const openSessions = async () => {
    await act(async () => { fireEvent.click(within(rowOf("Ann Owner")).getByRole("button", { name: "Sessions: 3" })); });
    await screen.findByText("Front desk PC");
  };

  test("lists every session with its client, device, IP and times", async () => {
    await mount();
    await openSessions();

    const desk = screen.getByText("Front desk PC").closest("tr") as HTMLElement;
    expect(within(desk).getByText("Desktop app")).toBeTruthy();
    expect(within(desk).getByText("203.0.113.9")).toBeTruthy();
    expect(within(desk).getByText("Never")).toBeTruthy();
  });

  test("Revoke all warns about the desktop app and ends every session only after Yes", async () => {
    await mount();
    await openSessions();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "End all sessions" })); });
    const text = confirmCard().textContent ?? "";
    expect(text).toContain("End every session of Ann Owner?");
    expect(text).toContain("including the desktop app");
    expect(callsTo("DELETE", "/admin/staff/12/sessions")).toHaveLength(0);

    await act(async () => { fireEvent.click(within(confirmCard()).getByRole("button", { name: "End all sessions" })); });
    await waitFor(() => expect(callsTo("DELETE", "/admin/staff/12/sessions")).toHaveLength(1));
  });

  test("Revoke all answered with Cancel ends nothing", async () => {
    await mount();
    await openSessions();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "End all sessions" })); });
    await act(async () => { fireEvent.click(within(confirmCard()).getByRole("button", { name: "Cancel" })); });

    expect(api.calls.filter((c) => c.method === "DELETE")).toEqual([]);
  });

  test("one session is ended by its own token id", async () => {
    await mount();
    await openSessions();

    const web = screen.getByText("Chrome").closest("tr") as HTMLElement;
    await act(async () => { fireEvent.click(within(web).getByRole("button", { name: "End session" })); });
    await act(async () => { fireEvent.click(within(confirmCard()).getByRole("button", { name: "End session" })); });

    await waitFor(() => expect(callsTo("DELETE", "/admin/staff/12/sessions/992")).toHaveLength(1));
    expect(callsTo("DELETE", "/admin/staff/12/sessions")).toHaveLength(0);
  });
});
