import type { ApiError } from "./client";
import { request } from "./client";

/**
 * The admin's Security section: blocked IP addresses and blocked countries
 * (web and Telegram access follow the role since 2026-09-29; nothing to grant).
 *
 * Every route sits in the backend's `routes/admin.php` behind the `admin`
 * middleware (no `/api` prefix) — that IS the authorisation boundary; the
 * panel's `menu.security` permission only decides what is drawn. Every write
 * is recorded in the audit log server-side.
 *
 * The types mirror the contract of 2026-09-29 field for field. Change them
 * together with the backend.
 */

/** Who created a rule, when the server still knows. */
export interface ISecurityActorApi {
  id: number;
  name: string;
}

/** A row of `GET /admin/ip-address`. */
export interface IBlockedIpApi {
  id: number;
  /** IPv4, IPv6 or a CIDR range. */
  ip_address: string;
  note: string | null;
  /**
   * `manual` (an administrator), or the system blocked it by itself
   * (2026-10-01): `auto_threat` (attack requests), `auto_login` (repeated
   * failed owner-web sign-ins). Unblocked the same way.
   */
  reason?: "manual" | "auto_threat" | "auto_login" | string;
  created_by: ISecurityActorApi | null;
  created_at: string;
}

export interface IBlockedIpListApi {
  data: IBlockedIpApi[];
  /** The address the server sees this request coming from. */
  your_ip: string;
}

export interface CreateBlockedIpBody {
  ip_address: string;
  note?: string;
}

/** A row of `GET /admin/security/countries`. */
export interface IBlockedCountryApi {
  id: number;
  /** ISO 3166-1 alpha-2. */
  country_code: string;
  note: string | null;
  created_by: ISecurityActorApi | null;
  created_at: string;
}

export interface IGeoIpStateApi {
  /** False = rules are saved but NOT enforced (the backend fails open). */
  available: boolean;
  updated_at: string | null;
}

export interface IBlockedCountryListApi {
  data: IBlockedCountryApi[];
  your_country: string | null;
  geoip: IGeoIpStateApi;
  /** Every code the server accepts, ISO 3166-1 alpha-2. */
  codes: string[];
}

export interface CreateBlockedCountryBody {
  country_code: string;
  note?: string;
}

export interface IMessageApi {
  message: string;
}

export const apiListBlockedIps = () => request<IBlockedIpListApi>("/admin/ip-address");

/**
 * 201 with the new row. Whether it arrives bare or wrapped in `data` is not
 * pinned by the contract, so nothing reads it: the screen re-reads the list,
 * which is also what shows the row exactly as the server stored it.
 */
export const apiCreateBlockedIp = (body: CreateBlockedIpBody) =>
  request<unknown>("/admin/ip-address", { method: "POST", body });

export const apiDeleteBlockedIp = (id: number) =>
  request<IMessageApi>(`/admin/ip-address/${id}`, { method: "DELETE" });

export const apiListBlockedCountries = () => request<IBlockedCountryListApi>("/admin/security/countries");

/** 201 with the new row; not read, for the same reason as {@link apiCreateBlockedIp}. */
export const apiCreateBlockedCountry = (body: CreateBlockedCountryBody) =>
  request<unknown>("/admin/security/countries", { method: "POST", body });

export const apiDeleteBlockedCountry = (id: number) =>
  request<IMessageApi>(`/admin/security/countries/${id}`, { method: "DELETE" });

/**
 * The sentence a refused write should show under its field: the first
 * `errors[field]` message of a 422, else the server's `message`, else null
 * (not a validation refusal — the caller falls back to its own copy).
 */
export const validationMessageOf = (error: unknown, field: string): string | null => {
  const err = error as ApiError | undefined;
  if (err?.status !== 422) return null;
  const body = err.body;
  if (!body || typeof body !== "object") return null;
  const { errors, message } = body as { errors?: Record<string, unknown>; message?: unknown };
  const forField = errors?.[field];
  if (Array.isArray(forField) && typeof forField[0] === "string") return forField[0];
  return typeof message === "string" ? message : null;
};
