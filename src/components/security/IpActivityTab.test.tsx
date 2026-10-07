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
  /** Rows to answer with (null = the fixture below). */
  rows: null as unknown[] | null,
  /** Make the next reads fail. */
  fail: null as unknown,
}));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { params?: Record<string, unknown> } = {}) => {
    api.calls.push({ path, params: opts.params });
    if (api.fail) return Promise.reject(api.fail);
    return Promise.resolve({
      data: api.rows ?? ROWS,
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
  { ...base, id: 1, source: "desktop", ip_address: "81.2.69.142", country_code: "GB", country_name: "United Kingdom", city_name: "London", visits_count: 7, user: { id: 5, name: "Olga Owner", email: "olga@club.test", role: "company_owner" }, device: "windows_pc", os_name: "windows", os_version: null },
  { ...base, id: 2, source: "mobile", ip_address: "2001:218::1", country_code: "JP", guest: { id: 9, name: "Gor Player" }, device: "iphone", os_name: "ios", os_version: "17.8" },
  // A row from a backend older than the device fields: neither key is sent.
  { ...base, id: 3, source: "website", ip_address: "216.160.83.56", country_code: null },
  { ...base, id: 4, source: "telegram_bot", ip_address: "149.154.167.99", country_code: null, device: null, os_name: null, os_version: null },
];

import IpActivityTab from "./IpActivityTab";

const last = () => api.calls[api.calls.length - 1].params ?? {};

beforeEach(() => { api.calls = []; api.lastPage = 3; api.rows = null; api.fail = null; });
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
    // Country, city, device and OS: a legacy row without the device keys reads
    // "Unknown" in both new columns too.
    expect(within(row("216.160.83.56")).getAllByText("Unknown")).toHaveLength(4);
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

    const [sourceSelect, countrySelect, , , sortSelect] = screen.getAllByRole("combobox");
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

  describe("device and OS (2026-10-07)", () => {
    test("two columns right after User, each cell labelled for the phone layout", async () => {
      await mount();
      const heads = Array.from(document.querySelectorAll("thead th")).map((th) => th.textContent);
      expect(heads.slice(0, 4)).toEqual(["User", "Device", "OS", "IP address"]);
      const cells = (screen.getByText("81.2.69.142").closest("tr") as HTMLElement).querySelectorAll("td");
      expect(cells[1].getAttribute("data-label")).toBe("Device");
      expect(cells[2].getAttribute("data-label")).toBe("OS");
    });

    test("names the device with its icon, and the OS with its version when there is one", async () => {
      await mount();
      const row = (ip: string) => screen.getByText(ip).closest("tr") as HTMLElement;

      const pc = row("81.2.69.142");
      expect(within(pc).getByText("Windows PC")).toBeTruthy();
      expect(within(pc).getByText("Windows")).toBeTruthy();
      expect(pc.querySelector(".ipa-device__icon")?.getAttribute("data-shape")).toBe("desktop");

      const phone = row("2001:218::1");
      expect(within(phone).getByText("iPhone")).toBeTruthy();
      expect(within(phone).getByText("iOS 17.8")).toBeTruthy();
      expect(phone.querySelector(".ipa-device__icon")?.getAttribute("data-shape")).toBe("phone");
      expect(phone.querySelector(".ipa-device__icon")?.getAttribute("aria-hidden")).toBe("true");

      // null from the backend: "Unknown", no icon.
      const bot = row("149.154.167.99");
      expect(within(bot).getAllByText("Unknown").length).toBeGreaterThanOrEqual(2);
      expect(bot.querySelector(".ipa-device__icon")).toBeNull();
    });

    test("an Android version, and a value a newer backend added, render as-is", async () => {
      api.rows = [
        { ...base, id: 7, source: "mobile", ip_address: "10.0.0.7", country_code: null, device: "android_tablet", os_name: "android", os_version: "15" },
        { ...base, id: 8, source: "mobile", ip_address: "10.0.0.8", country_code: null, device: "smart_tv", os_name: "tizen", os_version: "8" },
      ];
      render(<IpActivityTab />);
      const tablet = (await screen.findByText("10.0.0.7")).closest("tr") as HTMLElement;
      expect(within(tablet).getByText("Android tablet")).toBeTruthy();
      expect(within(tablet).getByText("Android 15")).toBeTruthy();
      expect(tablet.querySelector(".ipa-device__icon")?.getAttribute("data-shape")).toBe("tablet");
      const tv = screen.getByText("10.0.0.8").closest("tr") as HTMLElement;
      expect(within(tv).getByText("smart_tv")).toBeTruthy();
      expect(within(tv).getByText("tizen 8")).toBeTruthy();
    });

    test("the device and OS filters go to the server and start again on page 1", async () => {
      await mount();
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: /2/ })); });
      await waitFor(() => expect(last().page).toBe(2));
      expect(last().device).toBeUndefined();
      expect(last().os).toBeUndefined();

      const [, , deviceSelect, osSelect] = screen.getAllByRole("combobox");
      expect(within(deviceSelect).getAllByRole("option").map((o) => o.textContent)).toEqual([
        "All", "iPhone", "iPad", "Android phone", "Android tablet", "Windows PC", "Mac", "Linux PC", "Chromebook",
      ]);
      expect(within(osSelect).getAllByRole("option").map((o) => o.textContent)).toEqual([
        "All", "iOS", "iPadOS", "Android", "Windows", "macOS", "Linux", "ChromeOS",
      ]);

      await act(async () => { fireEvent.change(deviceSelect, { target: { value: "iphone" } }); });
      await waitFor(() => expect(last()).toMatchObject({ device: "iphone", page: 1 }));

      await act(async () => { fireEvent.click(screen.getByRole("button", { name: /2/ })); });
      await waitFor(() => expect(last().page).toBe(2));
      await act(async () => { fireEvent.change(osSelect, { target: { value: "ios" } }); });
      await waitFor(() => expect(last()).toMatchObject({ device: "iphone", os: "ios", page: 1 }));

      await act(async () => { fireEvent.change(deviceSelect, { target: { value: "" } }); });
      await waitFor(() => expect(last().device).toBeUndefined());
      expect(last().os).toBe("ios");
    });
  });

  describe("states", () => {
    test("nothing recorded at all is the empty state; a narrowed list with no rows is «no results»", async () => {
      api.rows = [];
      render(<IpActivityTab />);
      expect(await screen.findByText("No connections recorded yet")).toBeTruthy();

      const [sourceSelect] = screen.getAllByRole("combobox");
      await act(async () => { fireEvent.change(sourceSelect, { target: { value: "mobile" } }); });
      expect(await screen.findByText("No connections match.")).toBeTruthy();
      expect(screen.queryByText("No connections recorded yet")).toBeNull();
    });

    test("a failed read is the localized error with Retry, not «no connections»", async () => {
      api.fail = Object.assign(new Error("Server Error"), { status: 500, body: { message: "Server Error" } });
      render(<IpActivityTab />);
      expect(await screen.findByText("Could not load the IP activity")).toBeTruthy();
      expect(screen.queryByText("No connections match.")).toBeNull();

      api.fail = null;
      const before = api.calls.length;
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry" })); });
      await waitFor(() => expect(api.calls.length).toBe(before + 1));
      expect(await screen.findByText("81.2.69.142")).toBeTruthy();
    });
  });
});
