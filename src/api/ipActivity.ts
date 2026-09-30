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
