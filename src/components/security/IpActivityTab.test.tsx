// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IIpActivityApi } from "@/api/ipActivity";

/**
 * Security → IP activity (2026-09-30), driven down to the transport: every
 * assertion is about the query the backend's `/admin/ip-activity` receives
 * and how its rows read.
 */

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; params?: Record<string, unknown> }>,
  lastPage: 3,
}));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { params?: Record<string, unknown> } = {}) => {
    api.calls.push({ path, params: opts.params });
    return Promise.resolve({
      data: ROWS,
      meta: { current_page: opts.params?.page ?? 1, last_page: api.lastPage, per_page: 25, total: 60 },
      countries: { GB: "United Kingdom", JP: "Japan" },
    });
  },
  apiCache: { subscribe: () => () => {} },
}));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ lang: "en", t: (k: string) => t(k, "en") }) };
});

const base = { country_name: null, city_name: null, first_seen_at: "2026-09-01T10:00:00+04:00", last_seen_at: "2026-09-30T10:00:00+04:00", visits_count: 1, user: null, guest: null };
const ROWS: IIpActivityApi[] = [
  { ...base, id: 1, source: "desktop", ip_address: "81.2.69.142", country_code: "GB", country_name: "United Kingdom", city_name: "London", visits_count: 7, user: { id: 5, name: "Olga Owner", email: "olga@club.test", role: "company_owner" } },
  { ...base, id: 2, source: "mobile", ip_address: "2001:218::1", country_code: "JP", guest: { id: 9, name: "Gor Player" } },
  { ...base, id: 3, source: "website", ip_address: "216.160.83.56", country_code: null },
  { ...base, id: 4, source: "telegram_bot", ip_address: "149.154.167.99", country_code: null },
];

import IpActivityTab from "./IpActivityTab";

const last = () => api.calls[api.calls.length - 1].params ?? {};

beforeEach(() => { api.calls = []; api.lastPage = 3; });
afterEach(() => cleanup());

const mount = async () => {
  render(<IpActivityTab />);
  await screen.findByText("81.2.69.142");
};

describe("IP activity", () => {
  test("asks the server for page 1, newest last-seen first", async () => {
    await mount();
    expect(api.calls[0].path).toBe("/admin/ip-activity");
    expect(last()).toMatchObject({ sort: "last_seen", dir: "desc", page: 1, per_page: 25 });
    for (const key of ["search", "source", "country", "city", "user_id", "from", "to"]) {
      expect(last()[key], key).toBeUndefined();
    }
  });

  test("reads every kind of row: user, mobile player, anonymous, Telegram's servers", async () => {
    await mount();
    const row = (ip: string) => screen.getByText(ip).closest("tr") as HTMLElement;

    expect(within(row("81.2.69.142")).getByText("Olga Owner")).toBeTruthy();
    expect(within(row("81.2.69.142")).getByText("olga@club.test")).toBeTruthy();
    expect(within(row("81.2.69.142")).getByText("United Kingdom")).toBeTruthy();
    expect(within(row("81.2.69.142")).getByText("London")).toBeTruthy();
    expect(within(row("81.2.69.142")).getByText("Desktop").className).toContain("is-desktop");
    expect(within(row("81.2.69.142")).getByText("7")).toBeTruthy();

    expect(within(row("2001:218::1")).getByText("Gor Player")).toBeTruthy();
    expect(within(row("2001:218::1")).getByText("Mobile")).toBeTruthy();
    expect(within(row("2001:218::1")).getByText("Japan")).toBeTruthy();

    expect(within(row("216.160.83.56")).getByText("Anonymous")).toBeTruthy();
    expect(within(row("216.160.83.56")).getAllByText("Unknown")).toHaveLength(2);
    expect(within(row("149.154.167.99")).getByText("Telegram servers")).toBeTruthy();
    expect(within(row("149.154.167.99")).getByText("Telegram bot")).toBeTruthy();
  });

  test("says what the address is: the server's view, VPN included, location approximate", async () => {
    await mount();
    expect(screen.getByText(/Behind a VPN or proxy it is that service's address/)).toBeTruthy();
    expect(screen.queryByText(/exact/i)).toBeNull();
  });

  test("search is sent to the server after a pause, from page 1", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /2/ })); });
    await waitFor(() => expect(last().page).toBe(2));

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: " 81.2 " } });
    await waitFor(() => expect(last().search).toBe("81.2"), { timeout: 2000 });
    expect(last().page).toBe(1);
  });

  test("any filter change starts again on page 1", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /2/ })); });
    await waitFor(() => expect(last().page).toBe(2));

    const [sourceSelect, countrySelect, sortSelect] = screen.getAllByRole("combobox");
    await act(async () => { fireEvent.change(sourceSelect, { target: { value: "mobile" } }); });
    await waitFor(() => expect(last()).toMatchObject({ source: "mobile", page: 1 }));

    await act(async () => { fireEvent.change(countrySelect, { target: { value: "GB" } }); });
    await waitFor(() => expect(last()).toMatchObject({ source: "mobile", country: "GB", page: 1 }));

    await act(async () => { fireEvent.change(sortSelect, { target: { value: "visits" } }); });
    await waitFor(() => expect(last()).toMatchObject({ sort: "visits", page: 1 }));
  });

  test("the country filter offers the countries present, by name", async () => {
    await mount();
    const countrySelect = screen.getAllByRole("combobox")[1];
    const options = within(countrySelect).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["All", "United Kingdom", "Japan"]);
  });

  test("clicking a user or a city narrows the list; the chip removes it", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Olga Owner" })); });
    await waitFor(() => expect(last()).toMatchObject({ user_id: 5, page: 1 }));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "London" })); });
    await waitFor(() => expect(last()).toMatchObject({ user_id: 5, city: "London" }));

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Remove filter: Olga Owner" })); });
    await waitFor(() => expect(last().user_id).toBeUndefined());
    expect(last().city).toBe("London");
  });

  test("the date range is sent as whole days", async () => {
    await mount();
    const [from, to] = Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    await act(async () => { fireEvent.change(from, { target: { value: "2026-09-01" } }); });
    await act(async () => { fireEvent.change(to, { target: { value: "2026-09-30" } }); });
    await waitFor(() => expect(last()).toMatchObject({ from: "2026-09-01", to: "2026-09-30", page: 1 }));
  });
});
