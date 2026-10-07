import type { PaginatedList } from "@/types/api";
import { request } from "./client";

/**
 * The admin's IP activity — `GET /admin/ip-activity` (backend
 * `Admin\IpActivityController`, `admin` middleware, 2026-09-30).
 *
 * The address is the one the Cyber Place server saw: behind a VPN or proxy it
 * is that service's address, not the person's. Country and city are an
 * approximation from a GeoIP database. Types mirror `IpActivityResource`
 * field for field; change them together. The search box also matches the
 * network's organisation and "AS<number>" (2026-10-07).
 */

/** `App\Enums\IpActivitySource`. */
export const IP_ACTIVITY_SOURCES = ["website", "mobile", "desktop", "owner_web", "telegram", "telegram_bot"] as const;
export type IpActivitySource = (typeof IP_ACTIVITY_SOURCES)[number];

export type IpActivitySort = "last_seen" | "first_seen" | "visits";

/**
 * The device a connection came from, as the backend reads it off the
 * User-Agent (2026-10-07). `null` = it could not tell.
 */
export const IP_ACTIVITY_DEVICES = [
  "iphone", "ipad", "android_phone", "android_tablet", "windows_pc", "mac", "linux_pc", "chromebook",
] as const;
export type IpActivityDevice = (typeof IP_ACTIVITY_DEVICES)[number];

/** The operating system the same reading named. `null` = unknown. */
export const IP_ACTIVITY_OS = ["ios", "ipados", "android", "windows", "macos", "linux", "chromeos"] as const;
export type IpActivityOs = (typeof IP_ACTIVITY_OS)[number];

/**
 * The browser (or our own app) the same User-Agent named (2026-10-07);
 * `browser_version` carries its MAJOR version only. `null` = unknown.
 */
export const IP_ACTIVITY_BROWSERS = [
  "chrome", "edge", "firefox", "safari", "opera", "samsung", "electron", "telegram", "cyberplace_app",
] as const;
export type IpActivityBrowser = (typeof IP_ACTIVITY_BROWSERS)[number];

/**
 * Where a GeoIP database puts the ADDRESS (2026-10-07): the centre of the
 * network it belongs to, with the database's own accuracy radius. Not where
 * the person is; behind a VPN it is the VPN's network. The backend sends
 * `null` for Telegram's servers (`telegram_bot`) and for an unknown address.
 */
export interface IIpActivityLocation {
  latitude: number;
  longitude: number;
  accuracy_radius_km: number | null;
}

export const isKnownDevice = (value: string): value is IpActivityDevice =>
  (IP_ACTIVITY_DEVICES as readonly string[]).includes(value);
export const isKnownOs = (value: string): value is IpActivityOs =>
  (IP_ACTIVITY_OS as readonly string[]).includes(value);
export const isKnownBrowser = (value: string): value is IpActivityBrowser =>
  (IP_ACTIVITY_BROWSERS as readonly string[]).includes(value);

export interface IIpActivityApi {
  id: number;
  /** One of {@link IP_ACTIVITY_SOURCES}, or a value a newer backend added. */
  source: string;
  ip_address: string;
  country_code: string | null;
  /** English name from the GeoIP database; the panel names the code itself. */
  country_name: string | null;
  city_name: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  visits_count: number;
  /** A staff or admin account; null for a mobile player or an anonymous caller. */
  user: { id: number; name: string; email: string; role: string } | null;
  /** A mobile player (guest); null otherwise. */
  guest: { id: number; name: string | null } | null;
  /**
   * One of {@link IP_ACTIVITY_DEVICES}, null when unknown — or ABSENT from a
   * backend older than this field, which reads as unknown too. Typed `string`
   * so a value a newer backend adds still renders (as itself).
   */
  device?: string | null;
  /** One of {@link IP_ACTIVITY_OS}; null / absent = unknown. */
  os_name?: string | null;
  /** "17.8", "15", …; null when the User-Agent carried none. */
  os_version?: string | null;
  /*
   * 2026-10-07 — every field below is OPTIONAL for the same reason as the
   * device ones: a backend older than them omits the key, and the panel reads
   * an absent key exactly like `null` ("Not determined").
   */
  /** Region / province from the GeoIP database (English name). */
  region_name?: string | null;
  /** Autonomous System number of the network the address belongs to. */
  asn?: number | null;
  /** The organisation that runs that network: the provider, a host, a VPN. */
  as_org?: string | null;
  /** One of {@link IP_ACTIVITY_BROWSERS}; typed `string` so a newer value renders as sent. */
  browser?: string | null;
  /** The browser's MAJOR version ("129"). */
  browser_version?: string | null;
  location?: IIpActivityLocation | null;
}

export interface IIpActivityListApi extends PaginatedList<IIpActivityApi> {
  /** Countries present in the table: ISO code → English name. */
  countries?: Record<string, string | null>;
}

export interface IpActivityQuery {
  search?: string;
  source?: IpActivitySource;
  country?: string;
  city?: string;
  user_id?: number;
  /** Server-side filter by device kind. */
  device?: IpActivityDevice;
  /** Server-side filter by operating system. */
  os?: IpActivityOs;
  /** Server-side filter by network (Autonomous System number). */
  asn?: number;
  /** YYYY-MM-DD, last seen on or after. */
  from?: string;
  /** YYYY-MM-DD, last seen on or before. */
  to?: string;
  sort?: IpActivitySort;
  dir?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

export const apiListIpActivity = (params: IpActivityQuery) =>
  request<IIpActivityListApi>("/admin/ip-activity", { params });

/**
 * One row, read on its own — `GET /admin/ip-activity/{id}` (2026-10-07). Same
 * shape as a list row. The server writes an admin audit entry for every read,
 * which is why the details dialog asks for it instead of reusing the list row
 * (and why `/admin/*` is never in the client cache). 404 = the row is gone.
 */
export const apiGetIpActivity = (id: number) =>
  request<{ data: IIpActivityApi }>(`/admin/ip-activity/${id}`);
