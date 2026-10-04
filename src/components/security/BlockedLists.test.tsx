// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IBlockedCountryListApi, IBlockedIpListApi } from "@/api/security";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

/**
 * Blocked IPs and blocked countries, driven down to the transport. The server
 * decides what is a valid rule (422); these pin that its sentence reaches the
 * admin, that "your IP / country" is on screen, and that the GeoIP fail-open
 * is announced.
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

import BlockedCountriesTab from "./BlockedCountriesTab";
import BlockedIpsTab from "./BlockedIpsTab";

const apiError = (status: number, body: unknown) =>
  Object.assign(new Error((body as { message?: string })?.message ?? `HTTP ${status}`), { status, body });

const IPS: IBlockedIpListApi = {
  data: [
    { id: 1, ip_address: "198.51.100.0/24", note: "Scraper", reason: "manual", created_by: { id: 1, name: "Root" }, created_at: "2026-09-28T10:00:00Z" },
    { id: 2, ip_address: "203.0.113.66", note: "auto: sql_injection", reason: "auto_threat", created_by: null, created_at: "2026-10-01T10:00:00Z" },
    { id: 3, ip_address: "203.0.113.77", note: "auto: repeated failed owner-web sign-ins", reason: "auto_login", created_by: null, created_at: "2026-10-01T11:00:00Z" },
  ],
  your_ip: "203.0.113.9",
};

let countries: IBlockedCountryListApi;
const COUNTRIES = (available: boolean): IBlockedCountryListApi => ({
  data: [{ id: 5, country_code: "FR", note: null, created_by: null, created_at: "2026-09-28T10:00:00Z" }],
  your_country: "AM",
  geoip: { available, updated_at: null },
  codes: ["AM", "DE", "FR"],
});

let createIp: () => Promise<unknown>;

beforeEach(() => {
  api.calls = [];
  lang.current = "en";
  countries = COUNTRIES(true);
  createIp = async () => ({ data: {} });
  api.handler = async (c: Call) => {
    if (c.path === "/admin/ip-address" && c.method === "GET") return IPS;
    if (c.path === "/admin/ip-address" && c.method === "POST") return createIp();
    if (c.path === "/admin/security/countries" && c.method === "GET") return countries;
    if (c.method === "POST" || c.method === "DELETE") return { message: "ok" };
    throw new Error(`unexpected ${c.method} ${c.path}`);
  };
});
afterEach(() => cleanup());

const confirmCard = () => screen.getByRole("button", { name: "Cancel" }).closest(".card") as HTMLElement;

describe("blocked IPs", () => {
  const mount = async () => {
    render(<ConfirmProvider><BlockedIpsTab /></ConfirmProvider>);
    await screen.findByText("198.51.100.0/24");
  };
  const addressField = () => screen.getByPlaceholderText("203.0.113.7 or 203.0.113.0/24");

  test("shows the list and the admin's own address", async () => {
    await mount();
    expect(screen.getByText("203.0.113.9")).toBeTruthy();
    expect(screen.getByText("Scraper")).toBeTruthy();
    expect(screen.getByText("Root")).toBeTruthy();
  });

  test("marks what the system blocked by itself, and it unblocks like any other (2026-10-01)", async () => {
    await mount();
    const row = (ip: string) => screen.getByText(ip).closest("tr") as HTMLElement;
    expect(within(row("203.0.113.66")).getByText("System: attack requests").className).toContain("pill");
    expect(within(row("203.0.113.77")).getByText("System: password guessing")).toBeTruthy();
    expect(within(row("203.0.113.66")).getByRole("button", { name: "Unblock" })).toBeTruthy();
  });

  test("adding posts the address and the note, then re-reads the list", async () => {
    await mount();
    fireEvent.change(addressField(), { target: { value: " 192.0.2.1 " } });
    fireEvent.change(screen.getByRole("textbox", { name: "Note" }), { target: { value: "bot" } });

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Block" })); });

    const posts = api.calls.filter((c) => c.method === "POST");
    expect(posts).toEqual([{ path: "/admin/ip-address", method: "POST", body: { ip_address: "192.0.2.1", note: "bot" } }]);
    await waitFor(() => expect(api.calls.filter((c) => c.method === "GET" && c.path === "/admin/ip-address")).toHaveLength(2));
  });

  test("a 422 shows the server's own sentence under the field", async () => {
    createIp = () => Promise.reject(apiError(422, {
      message: "The given data was invalid.",
      errors: { ip_address: ["This rule would block your own address"] },
    }));
    await mount();
    fireEvent.change(addressField(), { target: { value: "203.0.113.0/24" } });

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Block" })); });

    expect((await screen.findByRole("alert")).textContent).toBe("This rule would block your own address");
    // What was typed stays, so it can be corrected.
    expect((addressField() as HTMLInputElement).value).toBe("203.0.113.0/24");
  });

  test("unblocking asks first and deletes by id", async () => {
    await mount();
    const row = screen.getByText("198.51.100.0/24").closest("tr") as HTMLElement;

    await act(async () => { fireEvent.click(within(row).getByRole("button", { name: "Unblock" })); });
    expect(confirmCard().textContent).toContain("Unblock 198.51.100.0/24?");
    expect(api.calls.some((c) => c.method === "DELETE")).toBe(false);

    await act(async () => { fireEvent.click(within(confirmCard()).getByRole("button", { name: "Unblock" })); });
    await waitFor(() => expect(api.calls.filter((c) => c.method === "DELETE" && c.path === "/admin/ip-address/1")).toHaveLength(1));
  });
});

describe("blocked countries", () => {
  const mount = async () => {
    render(<ConfirmProvider><BlockedCountriesTab /></ConfirmProvider>);
    await screen.findByText("France (FR)");
  };
  const GEOIP_WARNING = /GeoIP database is not installed/;

  test("names the codes in the reading language and shows the admin's country", async () => {
    await mount();
    expect(screen.getByText(/Your country:/).textContent).toContain("Armenia (AM)");
  });

  test("warns that rules are not enforced when GeoIP is unavailable", async () => {
    countries = COUNTRIES(false);
    await mount();
    expect(screen.getByText(GEOIP_WARNING)).toBeTruthy();
  });

  test("says nothing about GeoIP when it is available", async () => {
    await mount();
    expect(screen.queryByText(GEOIP_WARNING)).toBeNull();
  });

  test("Armenian reads the names in Armenian (the `hy` locale, not `am`)", async () => {
    lang.current = "am";
    render(<ConfirmProvider><BlockedCountriesTab /></ConfirmProvider>);
    const hy = new Intl.DisplayNames(["hy"], { type: "region" }).of("FR");
    await screen.findByText(`${hy} (FR)`);
  });

  test("a picked country is posted by its code; already blocked ones are not offered", async () => {
    await mount();
    const field = screen.getByRole("combobox", { name: "Country" });

    fireEvent.focus(field);
    const offered = screen.getAllByRole("option").map((o) => o.textContent);
    expect(offered).toEqual(["Armenia (AM)", "Germany (DE)"]);

    fireEvent.change(field, { target: { value: "germany" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Block" })); });

    expect(api.calls.filter((c) => c.method === "POST")).toEqual([
      { path: "/admin/security/countries", method: "POST", body: { country_code: "DE", note: undefined } },
    ]);
  });
});
