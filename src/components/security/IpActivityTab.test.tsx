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
  /** The details endpoint: the row it answers with (null = the list row of that id). */
  detail: null as unknown,
  /** Make the details read fail. */
  detailFail: null as unknown,
}));
vi.mock("@/api/client", () => ({
  request: (path: string, opts: { params?: Record<string, unknown> } = {}) => {
    api.calls.push({ path, params: opts.params });
    const detail = /^\/admin\/ip-activity\/(\d+)$/.exec(path);
    if (detail) {
      if (api.detailFail) return Promise.reject(api.detailFail);
      const id = Number(detail[1]);
      return Promise.resolve({ data: api.detail ?? (api.rows ?? ROWS).find((r) => (r as { id: number }).id === id) });
    }
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
// Leaflet has no place in jsdom: the dialog's map is a probe that records
// what it was asked to draw (BranchMap's own drawing is BranchMap.test.tsx).
const map = vi.hoisted(() => ({ props: [] as Array<Record<string, unknown>> }));
vi.mock("@/components/map/BranchMap", () => ({
  default: (props: Record<string, unknown>) => {
    map.props.push(props);
    return <div data-testid="ip-map" />;
  },
}));

const base = { country_name: null, city_name: null, first_seen_at: "2026-09-01T10:00:00+04:00", last_seen_at: "2026-09-30T10:00:00+04:00", visits_count: 1, user: null, guest: null };
const ROWS: IIpActivityApi[] = [
  {
    ...base, id: 1, source: "desktop", ip_address: "81.2.69.142", country_code: "GB", country_name: "United Kingdom", city_name: "London", visits_count: 7,
    user: { id: 5, name: "Olga Owner", email: "olga@club.test", role: "company_owner" }, device: "windows_pc", os_name: "windows", os_version: null,
    region_name: "England", asn: 2856, as_org: "British Telecommunications PLC", browser: "electron", browser_version: "33",
    location: { latitude: 51.5164, longitude: -0.093, accuracy_radius_km: 10 },
  },
  // A network known only by its number.
  { ...base, id: 2, source: "mobile", ip_address: "2001:218::1", country_code: "JP", guest: { id: 9, name: "Gor Player" }, device: "iphone", os_name: "ios", os_version: "17.8", asn: 2516, as_org: null, browser: "cyberplace_app", browser_version: null, location: null },
  // A row from a backend older than the device fields: neither key is sent.
  { ...base, id: 3, source: "website", ip_address: "216.160.83.56", country_code: null },
  { ...base, id: 4, source: "telegram_bot", ip_address: "149.154.167.99", country_code: null, device: null, os_name: null, os_version: null, asn: 62041, as_org: "Telegram Messenger Inc", location: null },
];

import IpActivityTab from "./IpActivityTab";

const last = () => api.calls[api.calls.length - 1].params ?? {};

beforeEach(() => {
  api.calls = []; api.lastPage = 3; api.rows = null; api.fail = null; api.detail = null; api.detailFail = null;
  map.props = [];
});
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
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "2" })); });
    await waitFor(() => expect(last().page).toBe(2));

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: " 81.2 " } });
    await waitFor(() => expect(last().search).toBe("81.2"), { timeout: 2000 });
    expect(last().page).toBe(1);
  });

  test("any filter change starts again on page 1", async () => {
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "2" })); });
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
      expect(heads.slice(0, 5)).toEqual(["User", "Device", "OS", "Provider / Network", "IP address"]);
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
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "2" })); });
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

      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "2" })); });
      await waitFor(() => expect(last().page).toBe(2));
      await act(async () => { fireEvent.change(osSelect, { target: { value: "ios" } }); });
      await waitFor(() => expect(last()).toMatchObject({ device: "iphone", os: "ios", page: 1 }));

      await act(async () => { fireEvent.change(deviceSelect, { target: { value: "" } }); });
      await waitFor(() => expect(last().device).toBeUndefined());
      expect(last().os).toBe("ios");
    });
  });

  describe("network, activity and the details dialog (2026-10-07)", () => {
    const row = (ip: string) => screen.getByText(ip).closest("tr") as HTMLElement;
    const detailCalls = (id: number) => api.calls.filter((c) => c.path === `/admin/ip-activity/${id}`).length;
    const dialog = () => screen.queryByRole("dialog");

    test("a Network column after OS: organisation over AS, the AS alone, or «Not determined»", async () => {
      await mount();
      const heads = Array.from(document.querySelectorAll("thead th")).map((th) => th.textContent);
      expect(heads[3]).toBe("Provider / Network");
      expect(heads.join(" ")).not.toMatch(/wi-?fi/i);

      const pc = row("81.2.69.142");
      const cell = pc.querySelectorAll("td")[3];
      expect(cell.getAttribute("data-label")).toBe("Provider / Network");
      expect(within(cell).getByRole("button", { name: "British Telecommunications PLC" })).toBeTruthy();
      expect(within(cell).getByText("AS2856").className).toContain("meta");

      // Only a number: the number is the label (and the filter).
      const phoneCell = row("2001:218::1").querySelectorAll("td")[3];
      expect(within(phoneCell).getByRole("button", { name: "AS2516" })).toBeTruthy();

      // A backend older than the field: nothing to say, and it says so.
      expect(within(row("216.160.83.56").querySelectorAll("td")[3] as HTMLElement).getByText("Not determined")).toBeTruthy();
    });

    test("«Activity», not «Visits», and it says what it counts", async () => {
      await mount();
      const head = Array.from(document.querySelectorAll("thead th")).at(-1) as HTMLElement;
      expect(head.textContent).toBe("Activity");
      expect(head.querySelector("[title]")?.getAttribute("title")).toBe("Number of 10-minute periods of activity");
      expect(screen.queryByText("Visits")).toBeNull();
    });

    test("clicking a network narrows the list by asn, from page 1; the chip removes it", async () => {
      await mount();
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "2" })); });
      await waitFor(() => expect(last().page).toBe(2));
      expect(last().asn).toBeUndefined();

      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "British Telecommunications PLC" })); });
      await waitFor(() => expect(last()).toMatchObject({ asn: 2856, page: 1 }));
      expect(dialog()).toBeNull();

      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Remove filter: British Telecommunications PLC (AS2856)" })); });
      await waitFor(() => expect(last().asn).toBeUndefined());
    });

    test("a row click opens the details, read once from the details endpoint", async () => {
      await mount();
      await act(async () => { fireEvent.click(within(row("81.2.69.142")).getByText("81.2.69.142")); });
      const box = await screen.findByRole("dialog");
      await within(box).findByRole("heading", { name: "81.2.69.142" });
      expect(detailCalls(1)).toBe(1);

      for (const text of [
        "Olga Owner", "olga@club.test", "Owner", "Desktop", "Windows PC", "Windows", "Electron 33",
        "British Telecommunications PLC", "AS2856", "United Kingdom", "England", "London", "7",
        "Number of 10-minute periods of activity",
      ]) {
        expect(within(box).getAllByText(text).length, text).toBeGreaterThan(0);
      }
      expect(within(box).getByRole("button", { name: "Copy IP" })).toBeTruthy();
      expect(detailCalls(1)).toBe(1);
    });

    test("the IP is copied with the existing clipboard idiom", async () => {
      const writeText = vi.fn(() => Promise.resolve());
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      await mount();
      await act(async () => { fireEvent.click(row("81.2.69.142")); });
      const box = await screen.findByRole("dialog");
      await act(async () => { fireEvent.click(await within(box).findByRole("button", { name: "Copy IP" })); });
      expect(writeText).toHaveBeenCalledWith("81.2.69.142");
      expect(await within(box).findByRole("button", { name: "Copied" })).toBeTruthy();
    });

    test("clicks on the user, the city or the network filter and never open the dialog", async () => {
      await mount();
      for (const name of ["Olga Owner", "London", "British Telecommunications PLC"]) {
        await act(async () => { fireEvent.click(screen.getByRole("button", { name })); });
      }
      await waitFor(() => expect(last()).toMatchObject({ user_id: 5, city: "London", asn: 2856 }));
      expect(dialog()).toBeNull();
      expect(api.calls.some((c) => /^\/admin\/ip-activity\/\d+$/.test(c.path))).toBe(false);
    });

    test("Enter on a focused row opens it; Enter on a control inside it does not", async () => {
      await mount();
      const pc = row("81.2.69.142");
      expect(pc.getAttribute("tabindex")).toBe("0");

      await act(async () => { fireEvent.keyDown(screen.getByRole("button", { name: "Olga Owner" }), { key: "Enter" }); });
      expect(dialog()).toBeNull();

      await act(async () => { fireEvent.keyDown(pc, { key: " " }); });
      expect(dialog()).toBeNull();

      await act(async () => { fireEvent.keyDown(pc, { key: "Enter" }); });
      expect(await screen.findByRole("dialog")).toBeTruthy();
      await waitFor(() => expect(detailCalls(1)).toBe(1));
    });

    test("a row that is gone reads «no longer exists»; any other failure, the error with Retry", async () => {
      api.detailFail = Object.assign(new Error("Not Found"), { status: 404, body: { message: "Not Found" } });
      await mount();
      await act(async () => { fireEvent.click(row("81.2.69.142")); });
      const box = await screen.findByRole("dialog");
      expect(await within(box).findByText("This record no longer exists")).toBeTruthy();
      expect(within(box).queryByRole("button", { name: "Retry" })).toBeNull();
      cleanup();

      api.detailFail = Object.assign(new Error("Server Error"), { status: 500, body: { message: "Server Error" } });
      await mount();
      await act(async () => { fireEvent.click(row("81.2.69.142")); });
      const box2 = await screen.findByRole("dialog");
      expect(await within(box2).findByText("Could not load the connection details")).toBeTruthy();
      api.detailFail = null;
      const before = detailCalls(1);
      await act(async () => { fireEvent.click(within(box2).getByRole("button", { name: "Retry" })); });
      expect(await within(box2).findByRole("heading", { name: "81.2.69.142" })).toBeTruthy();
      expect(detailCalls(1)).toBe(before + 1);
    });

    test("with a location: the map of the network's area, its radius, and the caption saying what it is", async () => {
      await mount();
      await act(async () => { fireEvent.click(row("81.2.69.142")); });
      const box = await screen.findByRole("dialog");
      expect(await within(box).findByTestId("ip-map")).toBeTruthy();
      expect(map.props.at(-1)).toMatchObject({
        center: { lat: 51.5164, lng: -0.093 },
        accuracyRadiusKm: 10,
        markers: [],
      });
      const caption = within(box).getByText(/Approximate location of the IP address/);
      expect(caption.textContent).toContain("about 10 km");
      expect(caption.textContent).toContain("not where the person is");
      expect(caption.textContent).toContain("VPN");
    });

    test("a location without a radius still gets the caption, without a number", async () => {
      api.detail = { ...ROWS[0], location: { latitude: 51.5, longitude: -0.1, accuracy_radius_km: null } };
      await mount();
      await act(async () => { fireEvent.click(row("81.2.69.142")); });
      const box = await screen.findByRole("dialog");
      expect(await within(box).findByTestId("ip-map")).toBeTruthy();
      expect(map.props.at(-1)?.accuracyRadiusKm).toBeNull();
      expect(within(box).getByText(/Approximate location of the IP address/).textContent).not.toMatch(/\d+ km/);
    });

    test("no location (or an older backend): no map, «IP location not determined»", async () => {
      await mount();
      await act(async () => { fireEvent.click(row("216.160.83.56")); });
      const box = await screen.findByRole("dialog");
      expect(await within(box).findByText("IP location not determined")).toBeTruthy();
      expect(within(box).queryByTestId("ip-map")).toBeNull();
      expect(map.props).toHaveLength(0);
      // Fields the older backend does not send read «Not determined».
      expect(within(box).getAllByText("Not determined").length).toBeGreaterThanOrEqual(3);
    });

    test("Telegram's servers: never a map, even if a location arrives, and the reason", async () => {
      api.detail = { ...ROWS[3], location: { latitude: 51.5, longitude: -0.1, accuracy_radius_km: 50 } };
      await mount();
      await act(async () => { fireEvent.click(row("149.154.167.99")); });
      const box = await screen.findByRole("dialog");
      expect(await within(box).findByText(/belongs to Telegram's servers/)).toBeTruthy();
      expect(within(box).queryByTestId("ip-map")).toBeNull();
      expect(within(box).queryByText(/Approximate location of the IP address/)).toBeNull();
      expect(map.props).toHaveLength(0);
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
