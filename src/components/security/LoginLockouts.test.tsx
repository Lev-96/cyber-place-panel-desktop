// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBlockedIpListApi, ILoginLockoutListApi } from "@/api/security";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

/**
 * Sign-ins closed after too many wrong passwords (2026-10-07), listed under
 * Blocked IPs and lifted from there. Driven down to the transport.
 */

interface Call { path: string; method: string; body?: unknown }
const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; body?: unknown }>,
  handler: (_c: { path: string; method: string; body?: unknown }): Promise<unknown> => Promise.reject(new Error("no handler")),
}));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const call = { path, method: opts.method ?? "GET", body: opts.body };
    api.calls.push(call);
    return api.handler(call);
  },
  apiCache: { subscribe: () => () => {} },
}));
const lang = vi.hoisted(() => ({ current: "en" as "en" | "ru" | "am" }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, lang.current), lang: lang.current }) };
});
vi.mock("@/components/ui/Modal", () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
}));

import BlockedIpsTab from "./BlockedIpsTab";

const apiError = (status: number, body: unknown) =>
  Object.assign(new Error((body as { message?: string })?.message ?? `HTTP ${status}`), { status, body });

const IPS: IBlockedIpListApi = {
  data: [{ id: 3, ip_address: "203.0.113.77", note: "auto", reason: "auto_login", created_by: null, created_at: "2026-10-07T10:00:00Z" }],
  your_ip: "203.0.113.9",
};

const LOCKS: ILoginLockoutListApi = {
  data: [
    {
      id: 11, client: "desktop", ip_address: "81.2.69.142", email: "manager@club.am",
      user: { id: 5, name: "Mila Manager", role: "manager" }, attempts: 11,
      locked_until: "2026-10-07T11:00:00Z", ip_banned: false, created_at: "2026-10-07T10:10:00Z",
    },
    {
      id: 12, client: "owner_web", ip_address: "203.0.113.77", email: "nobody@club.am",
      user: null, attempts: 11, locked_until: "2026-10-07T11:30:00Z", ip_banned: true, created_at: "2026-10-07T10:40:00Z",
    },
  ],
};

let locks: () => Promise<unknown>;

beforeEach(() => {
  api.calls = [];
  lang.current = "en";
  locks = async () => LOCKS;
  api.handler = async (c: Call) => {
    if (c.path === "/admin/ip-address" && c.method === "GET") return IPS;
    if (c.path === "/admin/security/login-lockouts" && c.method === "GET") return locks();
    if (c.method === "DELETE") return { message: "ok" };
    throw new Error(`unexpected ${c.method} ${c.path}`);
  };
});
afterEach(() => cleanup());

const confirmCard = () => screen.getByRole("button", { name: "Cancel" }).closest(".card") as HTMLElement;
const lockGets = () => api.calls.filter((c) => c.method === "GET" && c.path === "/admin/security/login-lockouts");
const mount = async () => {
  render(<ConfirmProvider><BlockedIpsTab /></ConfirmProvider>);
  await screen.findByText("manager@club.am");
};
const lockRow = (email: string) => screen.getByText(email).closest("tr") as HTMLElement;

describe("locked sign-ins", () => {
  test("are listed under Blocked IPs with who, from where, where and until when", async () => {
    await mount();
    expect(screen.getByRole("heading", { name: "Locked sign-ins" })).toBeTruthy();

    const manager = lockRow("manager@club.am");
    expect(within(manager).getByText("Mila Manager · Manager")).toBeTruthy();
    expect(within(manager).getByText("81.2.69.142")).toBeTruthy();
    expect(within(manager).getByText("Desktop")).toBeTruthy();
    expect(within(manager).getByText("11")).toBeTruthy();
    expect(within(manager).queryByText("The address is blocked too")).toBeNull();

    const nobody = lockRow("nobody@club.am");
    expect(within(nobody).getByText("No such account")).toBeTruthy();
    expect(within(nobody).getByText("Owner Web")).toBeTruthy();
    expect(within(nobody).getByText("The address is blocked too").className).toContain("pill");
  });

  test("unlock asks first, then deletes that lock by id and re-reads", async () => {
    await mount();

    await act(async () => { fireEvent.click(within(lockRow("manager@club.am")).getByRole("button", { name: "Unblock" })); });
    expect(confirmCard().textContent).toContain("Unlock sign-in for manager@club.am?");
    expect(api.calls.some((c) => c.method === "DELETE")).toBe(false);

    await act(async () => { fireEvent.click(within(confirmCard()).getByRole("button", { name: "Unblock" })); });
    await waitFor(() => expect(api.calls.filter((c) => c.method === "DELETE")).toEqual([
      { path: "/admin/security/login-lockouts/11", method: "DELETE", body: undefined },
    ]));
    await waitFor(() => expect(lockGets()).toHaveLength(2));
  });

  test("cancelling the question unlocks nothing", async () => {
    await mount();
    await act(async () => { fireEvent.click(within(lockRow("manager@club.am")).getByRole("button", { name: "Unblock" })); });
    await act(async () => { fireEvent.click(within(confirmCard()).getByRole("button", { name: "Cancel" })); });
    expect(api.calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  test("unblocking an address re-reads the locks too, since it may lift them", async () => {
    await mount();
    const ipRow = screen.getAllByText("203.0.113.77").map((el) => el.closest("tr") as HTMLElement)
      .find((tr) => within(tr).queryByText("System: password guessing")) as HTMLElement;

    await act(async () => { fireEvent.click(within(ipRow).getByRole("button", { name: "Unblock" })); });
    await act(async () => { fireEvent.click(within(confirmCard()).getByRole("button", { name: "Unblock" })); });

    await waitFor(() => expect(api.calls.some((c) => c.method === "DELETE" && c.path === "/admin/ip-address/3")).toBe(true));
    await waitFor(() => expect(lockGets()).toHaveLength(2));
  });

  test("none says so", async () => {
    locks = async () => ({ data: [] });
    render(<ConfirmProvider><BlockedIpsTab /></ConfirmProvider>);
    expect(await screen.findByText("No locked sign-ins.")).toBeTruthy();
  });

  test("a failed read is an error, never 'none'", async () => {
    locks = () => Promise.reject(apiError(500, { message: "Server error" }));
    render(<ConfirmProvider><BlockedIpsTab /></ConfirmProvider>);
    expect(await screen.findByText("Server error")).toBeTruthy();
    expect(screen.queryByText("No locked sign-ins.")).toBeNull();
  });

  test("a backend without the list yet hides the section", async () => {
    locks = () => Promise.reject(apiError(404, { message: "Not Found" }));
    render(<ConfirmProvider><BlockedIpsTab /></ConfirmProvider>);
    await screen.findByText("203.0.113.77");
    await waitFor(() => expect(lockGets()).toHaveLength(1));
    expect(screen.queryByRole("heading", { name: "Locked sign-ins" })).toBeNull();
    expect(screen.queryByText("Not Found")).toBeNull();
  });

  test("speaks Armenian and Russian", async () => {
    lang.current = "am";
    const { unmount } = render(<ConfirmProvider><BlockedIpsTab /></ConfirmProvider>);
    expect(await screen.findByRole("heading", { name: "Արգելափակված մուտքեր" })).toBeTruthy();
    expect(screen.getByText("Այդպիսի հաշիվ չկա")).toBeTruthy();
    unmount();
    lang.current = "ru";
    render(<ConfirmProvider><BlockedIpsTab /></ConfirmProvider>);
    expect(await screen.findByRole("heading", { name: "Заблокированные входы" })).toBeTruthy();
  });
});
