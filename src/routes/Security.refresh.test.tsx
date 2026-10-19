// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import Toaster from "@/components/ui/Toaster";

/**
 * Security → Refresh (2026-10-09), with the real tabs and the real Toaster,
 * driven down to the transport: which reads one click sends (exactly the lists
 * on screen, with the activity tab's current query), that the fresh answer
 * replaces the old one, one round at a time, and that the toast tells the
 * truth about how the round ended.
 */

interface Call { path: string; method: string; params?: Record<string, unknown> }
const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; params?: Record<string, unknown> }>,
  /** How many GETs each path has answered so far. */
  served: {} as Record<string, number>,
  /** Paths whose reads after the first one fail with a 500. */
  failAfterFirst: new Set<string>(),
  /** When set, every read after the first waits on this gate. */
  gate: null as Promise<void> | null,
}));

const apiError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status, body: { message: "Server error" } });

const ipRow = (id: number, ip: string) => ({ id, ip_address: ip, note: null, reason: "manual", created_by: null, created_at: "2026-10-01T10:00:00Z" });
const answer = (path: string, n: number, params?: Record<string, unknown>): unknown => {
  // The second answer differs from the first, so a refresh is visible.
  if (path === "/admin/ip-address") {
    return { data: n === 1 ? [ipRow(1, "198.51.100.1")] : [ipRow(1, "198.51.100.1"), ipRow(2, "203.0.113.2")], your_ip: "203.0.113.9" };
  }
  if (path === "/admin/security/login-lockouts") return { data: [] };
  if (path === "/admin/security/countries") {
    const fr = { id: 5, country_code: "FR", note: null, created_by: null, created_at: "2026-09-28T10:00:00Z" };
    const de = { id: 6, country_code: "DE", note: null, created_by: null, created_at: "2026-09-29T10:00:00Z" };
    return { data: n === 1 ? [fr] : [fr, de], your_country: "AM", geoip: { available: true, updated_at: null }, codes: ["AM", "DE", "FR"] };
  }
  if (path === "/admin/ip-activity") {
    return {
      data: [{
        id: n, source: "desktop", ip_address: `81.2.69.${n}`, country_code: null, country_name: null, city_name: null,
        first_seen_at: "2026-09-01T10:00:00Z", last_seen_at: "2026-09-30T10:00:00Z", visits_count: 1, user: null, guest: null,
      }],
      meta: { current_page: params?.page ?? 1, last_page: 3, per_page: 25, total: 60 },
      countries: {},
    };
  }
  throw new Error(`unexpected ${path}`);
};

vi.mock("@/api/client", () => ({
  request: async (path: string, opts: { method?: string; params?: Record<string, unknown> } = {}) => {
    const call: Call = { path, method: opts.method ?? "GET", params: opts.params };
    api.calls.push(call);
    const n = (api.served[path] = (api.served[path] ?? 0) + 1);
    if (n > 1 && api.gate) await api.gate;
    if (n > 1 && api.failAfterFirst.has(path)) throw apiError(500);
    return answer(path, n, opts.params);
  },
  apiCache: { subscribe: () => () => {} },
}));
const lang = vi.hoisted(() => ({ current: "en" as "en" | "ru" | "am" }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ t: (k: string) => t(k, lang.current), lang: lang.current }) };
});

import Security from "./Security";

beforeEach(() => {
  api.calls = [];
  api.served = {};
  api.failAfterFirst = new Set();
  api.gate = null;
  lang.current = "en";
});
afterEach(() => cleanup());

const mountAt = async (tab: "ips" | "countries" | "activity", firstText: string) => {
  render(
    <MemoryRouter initialEntries={[`/security?tab=${tab}`]}>
      <ConfirmProvider>
        <Security />
        <Toaster />
      </ConfirmProvider>
    </MemoryRouter>,
  );
  await screen.findByText(firstText);
};

const refreshButton = () => screen.getByRole("button", { name: lang.current === "ru" ? "Обновить" : "Refresh" });
const readsOf = (path: string) => api.calls.filter((c) => c.path === path && c.method === "GET");
const toasts = () => Array.from(document.querySelectorAll(".cp-toaster .cp-toast")).map((n) => n.textContent ?? "");
const READ_PATHS = ["/admin/ip-address", "/admin/security/login-lockouts", "/admin/security/countries", "/admin/ip-activity"];
const counts = () => Object.fromEntries(READ_PATHS.map((p) => [p, readsOf(p).length]));

const clickRefresh = async () => {
  await act(async () => { fireEvent.click(refreshButton()); });
};

describe("Refresh", () => {
  test("on the IP tab re-reads blocked IPs and locked sign-ins once each, nothing else, and shows the new rows", async () => {
    await mountAt("ips", "198.51.100.1");
    const before = counts();

    await clickRefresh();
    await screen.findByText("203.0.113.2");

    expect(counts()).toEqual({
      ...before,
      "/admin/ip-address": before["/admin/ip-address"] + 1,
      "/admin/security/login-lockouts": before["/admin/security/login-lockouts"] + 1,
    });
    // Replaced, not appended: the row both answers carry is on screen once.
    expect(screen.getAllByText("198.51.100.1")).toHaveLength(1);
    await waitFor(() => expect(toasts()).toEqual(["✓Refreshed"]));
    expect((refreshButton() as HTMLButtonElement).disabled).toBe(false);
  });

  test("on the countries tab re-reads the blocked countries only", async () => {
    await mountAt("countries", "France (FR)");
    const before = counts();

    await clickRefresh();
    await screen.findByText("Germany (DE)");

    expect(counts()).toEqual({ ...before, "/admin/security/countries": before["/admin/security/countries"] + 1 });
    expect(screen.getAllByText("France (FR)")).toHaveLength(1);
  });

  test("on the activity tab re-reads the current filters and page", async () => {
    await mountAt("activity", "81.2.69.1");
    const [sourceSelect] = screen.getAllByRole("combobox");
    await act(async () => { fireEvent.change(sourceSelect, { target: { value: "mobile" } }); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "2" })); });
    await waitFor(() => expect(readsOf("/admin/ip-activity").at(-1)?.params).toMatchObject({ source: "mobile", page: 2 }));
    const before = counts();
    const query = readsOf("/admin/ip-activity").at(-1)?.params;

    await clickRefresh();
    await waitFor(() => expect(toasts()).toEqual(["✓Refreshed"]));

    expect(counts()).toEqual({ ...before, "/admin/ip-activity": before["/admin/ip-activity"] + 1 });
    expect(readsOf("/admin/ip-activity").at(-1)?.params).toEqual(query);
  });

  test("a second click while a round is in flight starts no second round", async () => {
    await mountAt("ips", "198.51.100.1");
    const before = counts();
    let open: () => void = () => {};
    api.gate = new Promise<void>((resolve) => { open = resolve; });

    // Both clicks land before React re-renders the button as disabled: only
    // the in-flight guard can stop the second one.
    act(() => {
      refreshButton().click();
      refreshButton().click();
    });
    expect((refreshButton() as HTMLButtonElement).disabled).toBe(true);
    expect(refreshButton().getAttribute("aria-busy")).toBe("true");

    await act(async () => { open(); });
    await waitFor(() => expect((refreshButton() as HTMLButtonElement).disabled).toBe(false));

    expect(readsOf("/admin/ip-address").length).toBe(before["/admin/ip-address"] + 1);
    expect(readsOf("/admin/security/login-lockouts").length).toBe(before["/admin/security/login-lockouts"] + 1);
    expect(toasts()).toEqual(["✓Refreshed"]);
  });

  test("a failed read: error toast, no success toast, the data and its notice stay, the button comes back", async () => {
    await mountAt("ips", "198.51.100.1");
    api.failAfterFirst.add("/admin/ip-address");

    await clickRefresh();

    await waitFor(() => expect(toasts()).toEqual(["✕Could not refresh"]));
    expect(toasts().some((text) => text.includes("Refreshed"))).toBe(false);
    // The rows that were there stay, under the list's own "could not refresh" notice.
    expect(screen.getByText("198.51.100.1")).toBeTruthy();
    expect(screen.getByText("Could not refresh. This is the last loaded data.")).toBeTruthy();
    expect((refreshButton() as HTMLButtonElement).disabled).toBe(false);
  });

  test("a list that never loaded keeps its ErrorState after a failed refresh", async () => {
    api.failAfterFirst.add("/admin/security/countries");
    api.served["/admin/security/countries"] = 1; // the very first read already fails
    render(
      <MemoryRouter initialEntries={["/security?tab=countries"]}>
        <ConfirmProvider>
          <Security />
          <Toaster />
        </ConfirmProvider>
      </MemoryRouter>,
    );
    await screen.findByRole("button", { name: "Retry" });

    await clickRefresh();

    await waitFor(() => expect(toasts()).toEqual(["✕Could not refresh"]));
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect((refreshButton() as HTMLButtonElement).disabled).toBe(false);
  });

  test("a tab that was switched away from is not asked again", async () => {
    await mountAt("ips", "198.51.100.1");
    await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "Blocked countries" })); });
    await screen.findByText("France (FR)");
    const before = counts();

    await clickRefresh();
    await screen.findByText("Germany (DE)");

    expect(counts()).toEqual({ ...before, "/admin/security/countries": before["/admin/security/countries"] + 1 });
  });

  test("speaks the reading language", async () => {
    lang.current = "ru";
    await mountAt("ips", "198.51.100.1");

    await clickRefresh();

    await waitFor(() => expect(toasts()).toEqual(["✓Обновлено"]));
    expect(within(refreshButton()).getByText("Обновить")).toBeTruthy();
  });
});
