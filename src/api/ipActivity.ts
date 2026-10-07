import type { PaginatedList } from "@/types/api";
import { request } from "./client";

/**
 * The admin's IP activity — `GET /admin/ip-activity` (backend
 * `Admin\IpActivityController`, `admin` middleware, 2026-09-30).
 *
 * The address is the one the Cyber Place server saw: behind a VPN or proxy it
 * is that service's address, not the person's. Country and city are an
 * approximation from a GeoIP database. Types mirror `IpActivityResource`
 * field for field; change them together.
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

export const isKnownDevice = (value: string): value is IpActivityDevice =>
  (IP_ACTIVITY_DEVICES as readonly string[]).includes(value);
export const isKnownOs = (value: string): value is IpActivityOs =>
  (IP_ACTIVITY_OS as readonly string[]).includes(value);

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
